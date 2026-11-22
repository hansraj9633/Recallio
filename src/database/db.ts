import Dexie, { type Table } from 'dexie';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import type { AudioBlobRecord, Bookmark, Recording } from '../types/recording';
import type { RevisionActivity, RevisionQueue } from '../types/revision';
import type { UserSettings } from '../types/settings';

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
