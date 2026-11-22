import { db, createId } from '../database/db';
import { toDateKey } from '../utils/formatTime';
import type { Subject, SubjectColor, SubjectIcon } from '../types/subject';
import type { Topic } from '../types/topic';
import type { Bookmark, Recording } from '../types/recording';
import type { RevisionQueue } from '../types/revision';

export async function createSubject(input: {
  name: string;
  color: SubjectColor;
  icon: SubjectIcon;
}): Promise<Subject> {
  const now = Date.now();
  const subject: Subject = {
    id: createId(),
    name: input.name.trim(),
    color: input.color,
    icon: input.icon,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.subjects.put(subject);
  return subject;
}

export async function updateSubject(
  id: string,
  changes: Partial<Pick<Subject, 'name' | 'color' | 'icon' | 'isArchived'>>,
): Promise<void> {
  await db.subjects.update(id, {
    ...changes,
    updatedAt: Date.now(),
  });
}

export async function deleteSubjectCascade(subjectId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.subjects, db.topics, db.recordings, db.audioBlobs, db.bookmarks, db.revisionQueues],
    async () => {
      const recs = await db.recordings.where('subjectId').equals(subjectId).toArray();
      const recIds = new Set(recs.map((r) => r.id));

      for (const recId of recIds) {
        await db.audioBlobs.delete(recId);
        await db.bookmarks.where('recordingId').equals(recId).delete();
      }
      await db.recordings.where('subjectId').equals(subjectId).delete();
      await db.topics.where('subjectId').equals(subjectId).delete();
      await db.subjects.delete(subjectId);

      const queues = await db.revisionQueues.toArray();
      for (const q of queues) {
        const nextIds = q.recordingIds.filter((id) => !recIds.has(id));
        const nextCompleted = q.completedIds.filter((id) => !recIds.has(id));
        if (nextIds.length !== q.recordingIds.length || nextCompleted.length !== q.completedIds.length) {
          await db.revisionQueues.update(q.id, {
            recordingIds: nextIds,
            completedIds: nextCompleted,
            updatedAt: Date.now(),
          });
        }
      }
    },
  );
}

export async function createTopic(input: {
  subjectId: string;
  name: string;
  description?: string;
}): Promise<Topic> {
  const now = Date.now();
  const topic: Topic = {
    id: createId(),
    subjectId: input.subjectId,
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', [db.topics, db.subjects], async () => {
    await db.topics.put(topic);
    await db.subjects.update(input.subjectId, { updatedAt: now });
  });
  return topic;
}

export async function updateTopic(
  id: string,
  changes: Partial<Pick<Topic, 'name' | 'description' | 'isArchived' | 'subjectId'>>,
): Promise<void> {
  const now = Date.now();
  await db.topics.update(id, { ...changes, updatedAt: now });
}

export async function deleteTopicCascade(topicId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.topics, db.recordings, db.audioBlobs, db.bookmarks, db.revisionQueues],
    async () => {
      const recs = await db.recordings.where('topicId').equals(topicId).toArray();
      const recIds = new Set(recs.map((r) => r.id));

      for (const recId of recIds) {
        await db.audioBlobs.delete(recId);
        await db.bookmarks.where('recordingId').equals(recId).delete();
      }
      await db.recordings.where('topicId').equals(topicId).delete();
      await db.topics.delete(topicId);

      const queues = await db.revisionQueues.toArray();
      for (const q of queues) {
        const nextIds = q.recordingIds.filter((id) => !recIds.has(id));
        const nextCompleted = q.completedIds.filter((id) => !recIds.has(id));
        if (nextIds.length !== q.recordingIds.length) {
          await db.revisionQueues.update(q.id, {
            recordingIds: nextIds,
            completedIds: nextCompleted,
            updatedAt: Date.now(),
          });
        }
      }
    },
  );
}

export async function saveNewRecording(input: {
  subjectId: string;
  topicId: string;
  title: string;
  description: string;
  tags: string[];
  duration: number;
  mimeType: string;
  blob: Blob;
  waveformPeaks?: number[];
  defaultSpeed?: number;
}): Promise<Recording> {
  const now = Date.now();
  const id = createId();
  const recording: Recording = {
    id,
    subjectId: input.subjectId,
    topicId: input.topicId,
    title: input.title.trim(),
    description: input.description.trim(),
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    duration: input.duration,
    mimeType: input.mimeType || input.blob.type || 'audio/webm',
    audioSize: input.blob.size,
    isFavourite: false,
    isArchived: false,
    deletedAt: null,
    lastPosition: 0,
    playbackSpeed: input.defaultSpeed ?? 1,
    playCount: 0,
    lastPlayedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(
    'rw',
    [db.recordings, db.audioBlobs, db.topics, db.subjects, db.revisionActivity],
    async () => {
      await db.recordings.put(recording);
      await db.audioBlobs.put({
        id,
        blob: input.blob,
        waveformPeaks: input.waveformPeaks,
      });
      await db.topics.update(input.topicId, { updatedAt: now });
      await db.subjects.update(input.subjectId, { updatedAt: now });

      const dateKey = toDateKey(new Date(now));
      const existing = await db.revisionActivity.get(dateKey);
      if (existing) {
        await db.revisionActivity.update(dateKey, {
          recordedSeconds: existing.recordedSeconds + Math.round(input.duration),
          sessionsCount: existing.sessionsCount + 1,
        });
      } else {
        await db.revisionActivity.put({
          date: dateKey,
          recordedSeconds: Math.round(input.duration),
          listenedSeconds: 0,
          sessionsCount: 1,
        });
      }
    },
  );

  return recording;
}

export async function updateRecording(
  id: string,
  changes: Partial<
    Pick<
      Recording,
      | 'title'
      | 'description'
      | 'tags'
      | 'isFavourite'
      | 'isArchived'
      | 'subjectId'
      | 'topicId'
      | 'lastPosition'
      | 'playbackSpeed'
      | 'playCount'
      | 'lastPlayedAt'
      | 'deletedAt'
    >
  >,
): Promise<void> {
  const now = Date.now();
  await db.recordings.update(id, { ...changes, updatedAt: now });
}

export async function moveRecording(
  recordingId: string,
  targetSubjectId: string,
  targetTopicId: string,
): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', [db.recordings, db.topics, db.subjects], async () => {
    await db.recordings.update(recordingId, {
      subjectId: targetSubjectId,
      topicId: targetTopicId,
      updatedAt: now,
    });
    await db.topics.update(targetTopicId, { updatedAt: now });
    await db.subjects.update(targetSubjectId, { updatedAt: now });
  });
}

export async function duplicateRecording(recordingId: string): Promise<Recording | null> {
  const original = await db.recordings.get(recordingId);
  const blobRecord = await db.audioBlobs.get(recordingId);
  if (!original || !blobRecord) return null;

  const originalBookmarks = await db.bookmarks.where('recordingId').equals(recordingId).toArray();
  const now = Date.now();
  const newId = createId();

  const copy: Recording = {
    ...original,
    id: newId,
    title: `${original.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
    lastPosition: 0,
    playCount: 0,
    lastPlayedAt: null,
    isSample: false,
  };

  await db.transaction('rw', [db.recordings, db.audioBlobs, db.bookmarks], async () => {
    await db.recordings.put(copy);
    await db.audioBlobs.put({
      id: newId,
      blob: blobRecord.blob,
      waveformPeaks: blobRecord.waveformPeaks,
    });
    for (const bm of originalBookmarks) {
      await db.bookmarks.put({
        ...bm,
        id: createId(),
        recordingId: newId,
        createdAt: now,
      });
    }
  });

  return copy;
}

export async function softDeleteRecording(recordingId: string): Promise<void> {
  await db.recordings.update(recordingId, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function restoreRecording(recordingId: string): Promise<void> {
  const rec = await db.recordings.get(recordingId);
  if (!rec) return;
  // Ensure parent subject & topic still exist; if not, keep intact or restore cleanly
  await db.recordings.update(recordingId, {
    deletedAt: null,
    updatedAt: Date.now(),
  });
}

export async function permanentlyDeleteRecording(recordingId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.recordings, db.audioBlobs, db.bookmarks, db.revisionQueues],
    async () => {
      await db.recordings.delete(recordingId);
      await db.audioBlobs.delete(recordingId);
      await db.bookmarks.where('recordingId').equals(recordingId).delete();

      const queues = await db.revisionQueues.toArray();
      for (const q of queues) {
        if (q.recordingIds.includes(recordingId) || q.completedIds.includes(recordingId)) {
          await db.revisionQueues.update(q.id, {
            recordingIds: q.recordingIds.filter((id) => id !== recordingId),
            completedIds: q.completedIds.filter((id) => id !== recordingId),
            updatedAt: Date.now(),
          });
        }
      }
    },
  );
}

export async function emptyTrash(): Promise<void> {
  const trashed = await db.recordings.filter((r) => r.deletedAt !== null).toArray();
  for (const r of trashed) {
    await permanentlyDeleteRecording(r.id);
  }
}

export async function addBookmark(input: {
  recordingId: string;
  timestamp: number;
  label: string;
}): Promise<Bookmark> {
  const bookmark: Bookmark = {
    id: createId(),
    recordingId: input.recordingId,
    timestamp: Math.max(0, input.timestamp),
    label: input.label.trim() || 'Key Moment',
    createdAt: Date.now(),
  };
  await db.bookmarks.put(bookmark);
  return bookmark;
}

export async function deleteBookmark(id: string): Promise<void> {
  await db.bookmarks.delete(id);
}

export async function updateBookmark(id: string, label: string): Promise<void> {
  await db.bookmarks.update(id, { label: label.trim() });
}

export async function createRevisionQueue(input: {
  name: string;
  description?: string;
  recordingIds?: string[];
}): Promise<RevisionQueue> {
  const now = Date.now();
  const queue: RevisionQueue = {
    id: createId(),
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    recordingIds: input.recordingIds ?? [],
    completedIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.revisionQueues.put(queue);
  return queue;
}

export async function updateRevisionQueue(
  id: string,
  changes: Partial<Pick<RevisionQueue, 'name' | 'description' | 'recordingIds' | 'completedIds'>>,
): Promise<void> {
  await db.revisionQueues.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteRevisionQueue(id: string): Promise<void> {
  await db.revisionQueues.delete(id);
}

export async function recordListeningSeconds(seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const dateKey = toDateKey(new Date());
  const existing = await db.revisionActivity.get(dateKey);
  if (existing) {
    await db.revisionActivity.update(dateKey, {
      listenedSeconds: existing.listenedSeconds + Math.round(seconds),
    });
  } else {
    await db.revisionActivity.put({
      date: dateKey,
      recordedSeconds: 0,
      listenedSeconds: Math.round(seconds),
      sessionsCount: 1,
    });
  }
}
