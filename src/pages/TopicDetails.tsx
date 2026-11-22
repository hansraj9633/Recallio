import React, { useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Mic, Play } from 'lucide-react';
import type { Recording, RecordingSort } from '../types/recording';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import {
  duplicateRecording,
  moveRecording,
  softDeleteRecording,
  updateRecording,
  updateTopic,
} from '../services/libraryService';
import { exportSingleRecording } from '../services/backupService';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { formatHumanDuration } from '../utils/formatTime';
import { RecordingRow } from '../components/library/RecordingRow';
import { TopicModal } from '../components/library/TopicModal';
import { RecordingEditModal } from '../components/library/RecordingEditModal';
import { MoveRecordingModal } from '../components/library/MoveRecordingModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

interface TopicDetailsProps {
  subject: Subject;
  topic: Topic;
  allSubjects: Subject[];
  allTopics: Topic[];
  recordings: Recording[];
  onBackToSubject: () => void;
  onRecordInTopic: (subjectId: string, topicId: string) => void;
  onAddToQueue: (rec: Recording) => void;
}

export const TopicDetails: React.FC<TopicDetailsProps> = ({
  subject,
  topic,
  allSubjects,
  allTopics,
  recordings,
  onBackToSubject,
  onRecordInTopic,
  onAddToQueue,
}) => {
  const { playRecording } = useAudioPlayer();
  const { showToast } = useToast();

  const [filterMode, setFilterMode] = useState<'active' | 'favourites' | 'archived'>('active');
  const [sort, setSort] = useState<RecordingSort>('newest');
  const [editTopicOpen, setEditTopicOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<Recording | null>(null);
  const [movingRec, setMovingRec] = useState<Recording | null>(null);
  const [deletingRec, setDeletingRec] = useState<Recording | null>(null);

  const visibleRecordings = useMemo(() => {
    const list = recordings.filter((r) => {
      if (filterMode === 'archived') return r.isArchived;
      if (r.isArchived) return false;
      if (filterMode === 'favourites') return r.isFavourite;
      return true;
    });

    return [...list].sort((a, b) => {
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
  }, [recordings, filterMode, sort]);

  const totalDuration = recordings
    .filter((r) => !r.isArchived)
    .reduce((sum, r) => sum + (r.duration || 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <button
          type="button"
          onClick={onBackToSubject}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{subject.name}</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {topic.name}
            </h1>
            {topic.description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                {topic.description}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {recordings.filter((r) => !r.isArchived).length} recordings ·{' '}
              {formatHumanDuration(totalDuration)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditTopicOpen(true)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Topic</span>
            </button>

            {visibleRecordings.length > 0 && (
              <button
                type="button"
                onClick={() => playRecording(visibleRecordings[0], visibleRecordings)}
                className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Play All</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onRecordInTopic(subject.id, topic.id)}
              className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Record Note</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70">
          {(['active', 'favourites', 'archived'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilterMode(m)}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-medium capitalize transition-colors ${
                filterMode === m
                  ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {m === 'active' ? 'All' : m}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as RecordingSort)}
          aria-label="Sort recordings"
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="longest">Longest duration</option>
          <option value="shortest">Shortest duration</option>
        </select>
      </div>

      {visibleRecordings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] py-14 px-6 text-center">
          <Mic className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            No recordings in this view
          </h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Record your explanation of {topic.name} to start building your personal audio revision deck.
          </p>
          <button
            type="button"
            onClick={() => onRecordInTopic(subject.id, topic.id)}
            className="mt-5 min-h-[42px] px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-indigo-700"
          >
            <Mic className="h-4 w-4" />
            <span>Record in {topic.name}</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          {visibleRecordings.map((rec) => (
            <RecordingRow
              key={rec.id}
              recording={rec}
              subject={subject}
              topic={topic}
              showBreadcrumb={false}
              queueContext={visibleRecordings}
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

      <TopicModal
        open={editTopicOpen}
        initial={topic}
        subjectName={subject.name}
        onClose={() => setEditTopicOpen(false)}
        onSave={async (data) => {
          await updateTopic(topic.id, data);
          showToast('Topic updated', 'success');
        }}
      />

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
        subjects={allSubjects}
        topics={allTopics}
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
