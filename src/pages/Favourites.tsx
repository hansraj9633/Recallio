import React, { useMemo, useState } from 'react';
import { Heart, Play } from 'lucide-react';
import type { Recording, RecordingSort } from '../types/recording';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import {
  duplicateRecording,
  moveRecording,
  softDeleteRecording,
  updateRecording,
} from '../services/libraryService';
import { exportSingleRecording } from '../services/backupService';
import { RecordingRow } from '../components/library/RecordingRow';
import { RecordingEditModal } from '../components/library/RecordingEditModal';
import { MoveRecordingModal } from '../components/library/MoveRecordingModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

interface FavouritesProps {
  recordings: Recording[];
  subjects: Subject[];
  topics: Topic[];
  onAddToQueue: (rec: Recording) => void;
}

export const Favourites: React.FC<FavouritesProps> = ({
  recordings,
  subjects,
  topics,
  onAddToQueue,
}) => {
  const { playRecording } = useAudioPlayer();
  const { showToast } = useToast();

  const [sort, setSort] = useState<RecordingSort>('newest');
  const [editingRec, setEditingRec] = useState<Recording | null>(null);
  const [movingRec, setMovingRec] = useState<Recording | null>(null);
  const [deletingRec, setDeletingRec] = useState<Recording | null>(null);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const favRecordings = useMemo(() => {
    const list = recordings.filter((r) => r.isFavourite && !r.isArchived);
    return list.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'longest':
          return b.duration - a.duration;
        case 'shortest':
          return a.duration - b.duration;
        case 'newest':
        default:
          return b.createdAt - a.createdAt;
      }
    });
  }, [recordings, sort]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Favourites
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            High-priority explanations starred for focused revision.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as RecordingSort)}
            aria-label="Sort favourites"
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="longest">Longest first</option>
            <option value="shortest">Shortest first</option>
          </select>

          {favRecordings.length > 0 && (
            <button
              type="button"
              onClick={() => playRecording(favRecordings[0], favRecordings)}
              className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Play All</span>
            </button>
          )}
        </div>
      </div>

      {favRecordings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] py-16 px-6 text-center">
          <Heart className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
          <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            No favourite recordings yet
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Tap the heart icon on any recording in your library or audio player to keep it handy here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          {favRecordings.map((rec) => (
            <RecordingRow
              key={rec.id}
              recording={rec}
              subject={subjectMap.get(rec.subjectId)}
              topic={topicMap.get(rec.topicId)}
              queueContext={favRecordings}
              onToggleFavourite={(r) => updateRecording(r.id, { isFavourite: !r.isFavourite })}
              onEdit={setEditingRec}
              onMove={setMovingRec}
              onDuplicate={async (r) => {
                await duplicateRecording(r.id);
                showToast('Recording duplicated', 'success');
              }}
              onExport={async (r) => {
                try {
                  await exportSingleRecording(r.id);
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Export failed', 'error');
                }
              }}
              onToggleArchive={(r) => updateRecording(r.id, { isArchived: !r.isArchived })}
              onAddToQueue={onAddToQueue}
              onDelete={setDeletingRec}
            />
          ))}
        </div>
      )}

      <RecordingEditModal
        recording={editingRec}
        onClose={() => setEditingRec(null)}
        onSave={async (id, data) => {
          await updateRecording(id, data);
          showToast('Recording updated', 'success');
        }}
      />

      <MoveRecordingModal
        recording={movingRec}
        subjects={subjects}
        topics={topics}
        onClose={() => setMovingRec(null)}
        onMove={async (recId, subjId, topId) => {
          await moveRecording(recId, subjId, topId);
          showToast('Recording moved', 'success');
        }}
      />

      <ConfirmDialog
        open={!!deletingRec}
        title="Move recording to Trash?"
        description={`"${deletingRec?.title ?? ''}" will be moved to Recently Deleted where you can restore it later.`}
        confirmLabel="Move to Trash"
        destructive
        onConfirm={async () => {
          if (deletingRec) {
            await softDeleteRecording(deletingRec.id);
            showToast('Moved to Recently Deleted', 'info');
            setDeletingRec(null);
          }
        }}
        onCancel={() => setDeletingRec(null)}
      />
    </div>
  );
};
