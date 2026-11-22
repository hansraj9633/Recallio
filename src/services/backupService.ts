import JSZip from 'jszip';
import { db, createId } from '../database/db';
import { getExtensionFromMimeType } from '../utils/audio';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import type { Bookmark, Recording } from '../types/recording';
import type { RevisionQueue } from '../types/revision';

export interface RecallioBackupManifest {
  app: 'Recallio';
  schemaVersion: 1;
  exportedAt: number;
  scope: 'full' | 'subject';
  subjects: Subject[];
  topics: Topic[];
  recordings: (Recording & { audioFile: string; waveformPeaks?: number[] })[];
  bookmarks: Bookmark[];
  revisionQueues: RevisionQueue[];
}

export interface ImportSummary {
  subjectsAdded: number;
  topicsAdded: number;
  recordingsAdded: number;
  bookmarksAdded: number;
  queuesAdded: number;
  skippedExisting: number;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\-_\s]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'recording';
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportSingleRecording(recordingId: string): Promise<void> {
  const rec = await db.recordings.get(recordingId);
  const audio = await db.audioBlobs.get(recordingId);
  if (!rec || !audio) {
    throw new Error('Audio data for this recording is missing.');
  }
  const ext = getExtensionFromMimeType(rec.mimeType || audio.blob.type);
  const filename = `${sanitizeFilename(rec.title)}.${ext}`;
  triggerFileDownload(audio.blob, filename);
}

export async function exportBackupArchive(subjectId?: string): Promise<void> {
  const zip = new JSZip();

  let subjects = await db.subjects.toArray();
  let topics = await db.topics.toArray();
  let recordings = await db.recordings.filter((r) => r.deletedAt === null).toArray();

  if (subjectId) {
    subjects = subjects.filter((s) => s.id === subjectId);
    topics = topics.filter((t) => t.subjectId === subjectId);
    recordings = recordings.filter((r) => r.subjectId === subjectId);
  }

  const recordingIds = new Set(recordings.map((r) => r.id));
  const bookmarks = (await db.bookmarks.toArray()).filter((b) => recordingIds.has(b.recordingId));
  const revisionQueues = subjectId ? [] : await db.revisionQueues.toArray();

  const audioFolder = zip.folder('audio');
  const manifestRecordings: RecallioBackupManifest['recordings'] = [];

  for (const rec of recordings) {
    const audioRecord = await db.audioBlobs.get(rec.id);
    if (!audioRecord || !audioRecord.blob || audioRecord.blob.size === 0) {
      continue;
    }
    const ext = getExtensionFromMimeType(rec.mimeType || audioRecord.blob.type);
    const audioPath = `audio/${rec.id}.${ext}`;
    audioFolder?.file(`${rec.id}.${ext}`, audioRecord.blob);
    manifestRecordings.push({
      ...rec,
      audioFile: audioPath,
      waveformPeaks: audioRecord.waveformPeaks,
    });
  }

  const manifest: RecallioBackupManifest = {
    app: 'Recallio',
    schemaVersion: 1,
    exportedAt: Date.now(),
    scope: subjectId ? 'subject' : 'full',
    subjects,
    topics,
    recordings: manifestRecordings,
    bookmarks,
    revisionQueues,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const archiveBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 5 },
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const prefix = subjectId && subjects[0] ? `recallio-${sanitizeFilename(subjects[0].name)}` : 'recallio-backup';
  triggerFileDownload(archiveBlob, `${prefix}-${dateStamp}.zip`);
}

export async function importBackupArchive(file: File): Promise<ImportSummary> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new Error('Please select a valid Recallio .zip backup archive.');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Could not read the ZIP archive. The file may be corrupted.');
  }

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid backup archive: manifest.json is missing.');
  }

  let manifest: RecallioBackupManifest;
  try {
    const raw = await manifestFile.async('string');
    manifest = JSON.parse(raw) as RecallioBackupManifest;
  } catch {
    throw new Error('Invalid backup archive: manifest.json could not be parsed.');
  }

  if (
    manifest.app !== 'Recallio' ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.subjects) ||
    !Array.isArray(manifest.topics) ||
    !Array.isArray(manifest.recordings)
  ) {
    throw new Error('Unsupported or invalid Recallio backup manifest format.');
  }

  // Pre-load & validate all referenced audio files before mutating DB
  const loadedAudio = new Map<string, { blob: Blob; waveformPeaks?: number[] }>();
  for (const rec of manifest.recordings) {
    if (!rec.id || !rec.audioFile) {
      throw new Error(`Invalid recording entry in manifest (${rec.title || 'unknown'}).`);
    }
    const zipEntry = zip.file(rec.audioFile);
    if (!zipEntry) {
      throw new Error(`Missing audio file in backup: ${rec.audioFile}`);
    }
    const arrayBuf = await zipEntry.async('arraybuffer');
    if (arrayBuf.byteLength === 0) {
      throw new Error(`Corrupted empty audio file in backup: ${rec.audioFile}`);
    }
    const blob = new Blob([arrayBuf], { type: rec.mimeType || 'audio/webm' });
    loadedAudio.set(rec.id, { blob, waveformPeaks: rec.waveformPeaks });
  }

  const summary: ImportSummary = {
    subjectsAdded: 0,
    topicsAdded: 0,
    recordingsAdded: 0,
    bookmarksAdded: 0,
    queuesAdded: 0,
    skippedExisting: 0,
  };

  await db.transaction(
    'rw',
    [db.subjects, db.topics, db.recordings, db.audioBlobs, db.bookmarks, db.revisionQueues],
    async () => {
      const subjectIdMap = new Map<string, string>();
      for (const s of manifest.subjects) {
        const existing = await db.subjects.get(s.id);
        if (existing) {
          subjectIdMap.set(s.id, existing.id);
        } else {
          const byName = await db.subjects.filter((ex) => ex.name.toLowerCase() === s.name.toLowerCase()).first();
          if (byName) {
            subjectIdMap.set(s.id, byName.id);
          } else {
            await db.subjects.put(s);
            subjectIdMap.set(s.id, s.id);
            summary.subjectsAdded++;
          }
        }
      }

      const topicIdMap = new Map<string, string>();
      for (const t of manifest.topics) {
        const mappedSubjectId = subjectIdMap.get(t.subjectId) ?? t.subjectId;
        const existing = await db.topics.get(t.id);
        if (existing) {
          topicIdMap.set(t.id, existing.id);
        } else {
          const byName = await db.topics
            .where('subjectId')
            .equals(mappedSubjectId)
            .filter((ex) => ex.name.toLowerCase() === t.name.toLowerCase())
            .first();
          if (byName) {
            topicIdMap.set(t.id, byName.id);
          } else {
            await db.topics.put({ ...t, subjectId: mappedSubjectId });
            topicIdMap.set(t.id, t.id);
            summary.topicsAdded++;
          }
        }
      }

      const recIdMap = new Map<string, string>();
      for (const rec of manifest.recordings) {
        const existing = await db.recordings.get(rec.id);
        if (existing && existing.createdAt === rec.createdAt) {
          recIdMap.set(rec.id, existing.id);
          summary.skippedExisting++;
          continue;
        }
        const finalId = existing ? createId() : rec.id;
        recIdMap.set(rec.id, finalId);

        const mappedSubjectId = subjectIdMap.get(rec.subjectId) ?? rec.subjectId;
        const mappedTopicId = topicIdMap.get(rec.topicId) ?? rec.topicId;
        const audioData = loadedAudio.get(rec.id)!;

        const { audioFile: _omitAudio, waveformPeaks: _omitPeaks, ...cleanRec } = rec;
        await db.recordings.put({
          ...cleanRec,
          id: finalId,
          subjectId: mappedSubjectId,
          topicId: mappedTopicId,
          deletedAt: null,
          isSample: false,
        });
        await db.audioBlobs.put({
          id: finalId,
          blob: audioData.blob,
          waveformPeaks: audioData.waveformPeaks,
        });
        summary.recordingsAdded++;
      }

      if (Array.isArray(manifest.bookmarks)) {
        for (const bm of manifest.bookmarks) {
          const mappedRecId = recIdMap.get(bm.recordingId);
          if (!mappedRecId) continue;
          const existingBm = await db.bookmarks.get(bm.id);
          if (existingBm) continue;
          await db.bookmarks.put({
            ...bm,
            id: existingBm ? createId() : bm.id,
            recordingId: mappedRecId,
          });
          summary.bookmarksAdded++;
        }
      }

      if (Array.isArray(manifest.revisionQueues)) {
        for (const q of manifest.revisionQueues) {
          const existingQ = await db.revisionQueues.get(q.id);
          if (existingQ) continue;
          await db.revisionQueues.put({
            ...q,
            recordingIds: q.recordingIds.map((id) => recIdMap.get(id) ?? id),
            completedIds: q.completedIds.map((id) => recIdMap.get(id) ?? id),
          });
          summary.queuesAdded++;
        }
      }
    },
  );

  return summary;
}
