import { useEffect, useState } from 'react';
import { db } from '../database/db';
import { initializeDatabase } from '../database/seed';
import { useLiveQuery } from './useDexieLive';
import { DEFAULT_USER_SETTINGS, type UserSettings } from '../types/settings';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import type { Bookmark, Recording } from '../types/recording';
import type { RevisionActivity, RevisionQueue } from '../types/revision';

export function useAppReady(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    initializeDatabase()
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch((err) => {
        console.error('Database initialization failed:', err);
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'IndexedDB could not be initialized. Check browser storage permissions or private browsing mode.',
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { ready, error };
}

export function useSubjects(): Subject[] {
  return useLiveQuery(() => db.subjects.orderBy('updatedAt').reverse().toArray(), []) ?? [];
}

export function useTopics(subjectId?: string): Topic[] {
  return (
    useLiveQuery(() => {
      if (subjectId) {
        return db.topics.where('subjectId').equals(subjectId).sortBy('updatedAt').then((arr) => arr.reverse());
      }
      return db.topics.orderBy('updatedAt').reverse().toArray();
    }, [subjectId]) ?? []
  );
}

export function useRecordings(options?: {
  subjectId?: string;
  topicId?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}): Recording[] {
  const { subjectId, topicId, includeDeleted = false, onlyDeleted = false } = options ?? {};
  return (
    useLiveQuery(async () => {
      let list: Recording[];
      if (topicId) {
        list = await db.recordings.where('topicId').equals(topicId).toArray();
      } else if (subjectId) {
        list = await db.recordings.where('subjectId').equals(subjectId).toArray();
      } else {
        list = await db.recordings.toArray();
      }
      if (onlyDeleted) {
        list = list.filter((r) => r.deletedAt !== null);
      } else if (!includeDeleted) {
        list = list.filter((r) => r.deletedAt === null);
      }
      return list.sort((a, b) => b.createdAt - a.createdAt);
    }, [subjectId, topicId, includeDeleted, onlyDeleted]) ?? []
  );
}

export function useBookmarks(recordingId?: string): Bookmark[] {
  return (
    useLiveQuery(() => {
      if (!recordingId) return [];
      return db.bookmarks.where('recordingId').equals(recordingId).sortBy('timestamp');
    }, [recordingId]) ?? []
  );
}

export function useRevisionQueues(): RevisionQueue[] {
  return useLiveQuery(() => db.revisionQueues.orderBy('updatedAt').reverse().toArray(), []) ?? [];
}

export function useRevisionActivity(): RevisionActivity[] {
  return useLiveQuery(() => db.revisionActivity.toArray(), []) ?? [];
}

export function useUserSettings(): UserSettings {
  return useLiveQuery(() => db.settings.get('user_settings'), []) ?? DEFAULT_USER_SETTINGS;
}
