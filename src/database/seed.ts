import { db } from './db';
import { createSampleWavBlob } from '../utils/audio';
import { toDateKey } from '../utils/formatTime';
import { DEFAULT_USER_SETTINGS } from '../types/settings';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import type { AudioBlobRecord, Bookmark, Recording } from '../types/recording';
import type { RevisionActivity, RevisionQueue } from '../types/revision';

let initPromise: Promise<void> | null = null;

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const existingSettings = await db.settings.get('user_settings');
    if (!existingSettings) {
      await db.settings.put(DEFAULT_USER_SETTINGS);
    }

    const subjectCount = await db.subjects.count();
    const recordingCount = await db.recordings.count();
    const settings = existingSettings ?? DEFAULT_USER_SETTINGS;

    if (subjectCount === 0 && recordingCount === 0 && !settings.sampleDataDismissed) {
      await seedInitialSampleData();
    }
  })();
  return initPromise;
}

export async function seedInitialSampleData(): Promise<void> {
  const now = Date.now();
  const day = 86400000;

  const subjects: Subject[] = [
    {
      id: 'sample-subj-civil',
      name: 'Civil Engineering',
      color: 'indigo',
      icon: 'compass',
      isArchived: false,
      createdAt: now - 10 * day,
      updatedAt: now - 2 * 3600000,
    },
    {
      id: 'sample-subj-physio',
      name: 'Human Physiology',
      color: 'teal',
      icon: 'atom',
      isArchived: false,
      createdAt: now - 8 * day,
      updatedAt: now - 1 * day,
    },
  ];

  const topics: Topic[] = [
    {
      id: 'sample-top-rcc',
      subjectId: 'sample-subj-civil',
      name: 'Reinforced Cement Concrete',
      description: 'Mix design, workability, shear reinforcement, and limit state concepts.',
      isArchived: false,
      createdAt: now - 10 * day,
      updatedAt: now - 2 * 3600000,
    },
    {
      id: 'sample-top-geo',
      subjectId: 'sample-subj-civil',
      name: 'Geotechnical Engineering',
      description: 'Soil mechanics, consolidation, and foundation bearing capacity.',
      isArchived: false,
      createdAt: now - 9 * day,
      updatedAt: now - 3 * day,
    },
    {
      id: 'sample-top-hydro',
      subjectId: 'sample-subj-civil',
      name: 'Hydrology',
      description: 'Precipitation analysis, runoff hydrographs, and flood routing.',
      isArchived: false,
      createdAt: now - 7 * day,
      updatedAt: now - 4 * day,
    },
    {
      id: 'sample-top-cardio',
      subjectId: 'sample-subj-physio',
      name: 'Cardiovascular System',
      description: 'Cardiac cycle mechanics, Starling law, and arterial pressure regulation.',
      isArchived: false,
      createdAt: now - 8 * day,
      updatedAt: now - 1 * day,
    },
  ];

  const wav1 = createSampleWavBlob(16, 261.63);
  const wav2 = createSampleWavBlob(14, 293.66);
  const wav3 = createSampleWavBlob(18, 329.63);
  const wav4 = createSampleWavBlob(12, 246.94);

  const recordings: Recording[] = [
    {
      id: 'sample-rec-concrete',
      subjectId: 'sample-subj-civil',
      topicId: 'sample-top-rcc',
      title: 'Properties of Concrete & Workability',
      description:
        'Explaining slump test ranges, water-cement ratio trade-offs, and 28-day compressive strength factors.',
      tags: ['concrete', 'lab-viva', 'important'],
      duration: 16,
      mimeType: 'audio/wav',
      audioSize: wav1.blob.size,
      isFavourite: true,
      isArchived: false,
      deletedAt: null,
      lastPosition: 6,
      playbackSpeed: 1,
      playCount: 4,
      lastPlayedAt: now - 2 * 3600000,
      createdAt: now - 5 * day,
      updatedAt: now - 2 * 3600000,
      isSample: true,
    },
    {
      id: 'sample-rec-bearing',
      subjectId: 'sample-subj-civil',
      topicId: 'sample-top-geo',
      title: "Terzaghi's Bearing Capacity Assumptions",
      description:
        'Key assumptions for shallow strip footings, local vs general shear failure, and water table correction.',
      tags: ['foundations', 'exam-focus'],
      duration: 14,
      mimeType: 'audio/wav',
      audioSize: wav2.blob.size,
      isFavourite: true,
      isArchived: false,
      deletedAt: null,
      lastPosition: 0,
      playbackSpeed: 1.25,
      playCount: 2,
      lastPlayedAt: now - 1 * day,
      createdAt: now - 4 * day,
      updatedAt: now - 1 * day,
      isSample: true,
    },
    {
      id: 'sample-rec-hydrograph',
      subjectId: 'sample-subj-civil',
      topicId: 'sample-top-hydro',
      title: 'Unit Hydrograph Derivation Steps',
      description:
        'Baseflow separation, effective rainfall hyetograph, and S-curve method for changing storm duration.',
      tags: ['hydrology', 'numericals'],
      duration: 18,
      mimeType: 'audio/wav',
      audioSize: wav3.blob.size,
      isFavourite: false,
      isArchived: false,
      deletedAt: null,
      lastPosition: 0,
      playbackSpeed: 1,
      playCount: 0,
      lastPlayedAt: null,
      createdAt: now - 2 * day,
      updatedAt: now - 2 * day,
      isSample: true,
    },
    {
      id: 'sample-rec-cardiac',
      subjectId: 'sample-subj-physio',
      topicId: 'sample-top-cardio',
      title: 'Cardiac Cycle & Pressure-Volume Loop',
      description:
        'Isovolumetric contraction, rapid ejection phase, dicrotic notch, and preload/afterload shifts.',
      tags: ['cardiology', 'high-yield'],
      duration: 12,
      mimeType: 'audio/wav',
      audioSize: wav4.blob.size,
      isFavourite: false,
      isArchived: false,
      deletedAt: null,
      lastPosition: 4,
      playbackSpeed: 1,
      playCount: 3,
      lastPlayedAt: now - 18 * 3600000,
      createdAt: now - 3 * day,
      updatedAt: now - 18 * 3600000,
      isSample: true,
    },
  ];

  const audioBlobs: AudioBlobRecord[] = [
    { id: 'sample-rec-concrete', blob: wav1.blob, waveformPeaks: wav1.peaks },
    { id: 'sample-rec-bearing', blob: wav2.blob, waveformPeaks: wav2.peaks },
    { id: 'sample-rec-hydrograph', blob: wav3.blob, waveformPeaks: wav3.peaks },
    { id: 'sample-rec-cardiac', blob: wav4.blob, waveformPeaks: wav4.peaks },
  ];

  const bookmarks: Bookmark[] = [
    {
      id: 'sample-bm-1',
      recordingId: 'sample-rec-concrete',
      timestamp: 3,
      label: 'Workability & Slump Cone',
      createdAt: now - 5 * day,
    },
    {
      id: 'sample-bm-2',
      recordingId: 'sample-rec-concrete',
      timestamp: 8,
      label: 'Water-Cement Ratio Law',
      createdAt: now - 5 * day,
    },
    {
      id: 'sample-bm-3',
      recordingId: 'sample-rec-concrete',
      timestamp: 12,
      label: '28-Day Compressive Strength',
      createdAt: now - 5 * day,
    },
    {
      id: 'sample-bm-4',
      recordingId: 'sample-rec-bearing',
      timestamp: 5,
      label: 'General vs Local Shear',
      createdAt: now - 4 * day,
    },
  ];

  const revisionQueues: RevisionQueue[] = [
    {
      id: 'sample-queue-midsem',
      name: 'Mid-Semester Revision',
      description: 'Core Civil Engineering explanations for upcoming mid-sem review.',
      recordingIds: ['sample-rec-concrete', 'sample-rec-bearing', 'sample-rec-hydrograph'],
      completedIds: ['sample-rec-concrete'],
      createdAt: now - 3 * day,
      updatedAt: now - 2 * 3600000,
    },
    {
      id: 'sample-queue-difficult',
      name: 'Difficult Concepts',
      description: 'High-yield concepts to revisit with A-B repeat.',
      recordingIds: ['sample-rec-bearing', 'sample-rec-cardiac'],
      completedIds: [],
      createdAt: now - 2 * day,
      updatedAt: now - 1 * day,
    },
  ];

  const activityEntries: RevisionActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * day);
    const key = toDateKey(d);
    const sampleMins = [12, 0, 18, 8, 24, 15, 6][6 - i] ?? 0;
    activityEntries.push({
      date: key,
      recordedSeconds: Math.round(sampleMins * 0.4 * 60),
      listenedSeconds: Math.round(sampleMins * 0.6 * 60),
      sessionsCount: sampleMins > 0 ? 1 : 0,
    });
  }

  await db.transaction(
    'rw',
    [db.subjects, db.topics, db.recordings, db.audioBlobs, db.bookmarks, db.revisionQueues, db.revisionActivity],
    async () => {
      await db.subjects.bulkPut(subjects);
      await db.topics.bulkPut(topics);
      await db.recordings.bulkPut(recordings);
      await db.audioBlobs.bulkPut(audioBlobs);
      await db.bookmarks.bulkPut(bookmarks);
      await db.revisionQueues.bulkPut(revisionQueues);
      await db.revisionActivity.bulkPut(activityEntries);
    },
  );
}

export async function removeAllSampleData(): Promise<void> {
  const sampleRecordings = await db.recordings.filter((r) => Boolean(r.isSample)).toArray();
  const sampleRecIds = sampleRecordings.map((r) => r.id);
  const sampleSubjectIds = ['sample-subj-civil', 'sample-subj-physio'];
  const sampleTopicIds = ['sample-top-rcc', 'sample-top-geo', 'sample-top-hydro', 'sample-top-cardio'];
  const sampleQueueIds = ['sample-queue-midsem', 'sample-queue-difficult'];

  await db.transaction(
    'rw',
    [db.subjects, db.topics, db.recordings, db.audioBlobs, db.bookmarks, db.revisionQueues, db.settings],
    async () => {
      for (const recId of sampleRecIds) {
        await db.recordings.delete(recId);
        await db.audioBlobs.delete(recId);
        await db.bookmarks.where('recordingId').equals(recId).delete();
      }
      for (const topicId of sampleTopicIds) {
        const remaining = await db.recordings.where('topicId').equals(topicId).count();
        if (remaining === 0) await db.topics.delete(topicId);
      }
      for (const subjId of sampleSubjectIds) {
        const remainingTopics = await db.topics.where('subjectId').equals(subjId).count();
        if (remainingTopics === 0) await db.subjects.delete(subjId);
      }
      await db.revisionQueues.bulkDelete(sampleQueueIds);
      await db.settings.update('user_settings', { sampleDataDismissed: true });
    },
  );
}
