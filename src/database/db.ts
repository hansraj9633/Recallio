import Dexie, { type Table } from 'dexie';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import type { AudioBlobRecord, Bookmark, Recording } from '../types/recording';
import type { RevisionActivity, RevisionQueue } from '../types/revision';
import type { UserSettings } from '../types/settings';
import { toDateKey } from '../utils/formatTime';

const LEGACY_SEEDED_ACTIVITY_PAIRS = new Set([
  '288:432',
  '432:648',
  '192:288',
  '576:864',
  '360:540',
  '144:216',
]);

export class RecallioDatabase extends Dexie {
  subjects!: Table<Subject, string>;
  topics!: Table<Topic, string>;
  recordings!: Table<Recording, string>;
  audioBlobs!: Table<AudioBlobRecord, string>;
  bookmarks!: Table<Bookmark, string>;
  revisionQueues!: Table<RevisionQueue, string>;
  revisionActivity!: Table<RevisionActivity, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super('RecallioDB');
    this.version(1).stores({
      subjects: 'id, name, isArchived, updatedAt',
      topics: 'id, subjectId, name, isArchived, updatedAt',
      recordings: 'id, subjectId, topicId, title, isFavourite, isArchived, deletedAt, lastPlayedAt, createdAt, updatedAt',
      audioBlobs: 'id',
      bookmarks: 'id, recordingId, timestamp',
      revisionQueues: 'id, name, updatedAt',
      revisionActivity: 'date',
      settings: 'id',
    });

    // v2: Remove legacy dummy-seeded revisionActivity rows and backfill from real user recordings
    this.version(2)
      .stores({
        subjects: 'id, name, isArchived, updatedAt',
        topics: 'id, subjectId, name, isArchived, updatedAt',
        recordings: 'id, subjectId, topicId, title, isFavourite, isArchived, deletedAt, lastPlayedAt, createdAt, updatedAt',
        audioBlobs: 'id',
        bookmarks: 'id, recordingId, timestamp',
        revisionQueues: 'id, name, updatedAt',
        revisionActivity: 'date',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        const activities = await tx.table<RevisionActivity, string>('revisionActivity').toArray();
        for (const act of activities) {
          const sig = `${act.recordedSeconds}:${act.listenedSeconds}`;
          if (LEGACY_SEEDED_ACTIVITY_PAIRS.has(sig) || (act.recordedSeconds === 0 && act.listenedSeconds === 0)) {
            await tx.table<RevisionActivity, string>('revisionActivity').delete(act.date);
          }
        }

        // Ensure real user-created recordings are reflected in revisionActivity
        const recs = await tx.table<Recording, string>('recordings').toArray();
        for (const rec of recs) {
          if (rec.isSample || rec.deletedAt !== null) continue;
          const dateKey = toDateKey(new Date(rec.createdAt));
          const existing = await tx.table<RevisionActivity, string>('revisionActivity').get(dateKey);
          if (!existing) {
            await tx.table<RevisionActivity, string>('revisionActivity').put({
              date: dateKey,
              recordedSeconds: Math.round(rec.duration || 0),
              listenedSeconds: 0,
              sessionsCount: 1,
            });
          }
        }
      });
  }
}

export const db = new RecallioDatabase();

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
