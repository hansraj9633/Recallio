import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  ListMusic,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import type { Recording } from '../types/recording';
import type { RevisionQueue } from '../types/revision';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import {
  createRevisionQueue,
  deleteRevisionQueue,
  updateRevisionQueue,
} from '../services/libraryService';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { formatDuration, formatHumanDuration } from '../utils/formatTime';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

interface RevisionProps {
  queues: RevisionQueue[];
  recordings: Recording[];
  subjects: Subject[];
  topics: Topic[];
}

export const Revision: React.FC<RevisionProps> = ({
  queues,
  recordings,
  subjects,
  topics,
}) => {
  const {
    currentRecording,
    isPlaying,
    repeatCurrent,
    shuffleQueue,
    playRecording,
    toggleRepeatCurrent,
    toggleShuffleQueue,
  } = useAudioPlayer();
  const { showToast } = useToast();

  const [selectedQueueId, setSelectedQueueId] = useState<string>(queues[0]?.id ?? '');
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<RevisionQueue | null>(null);
  const [queueName, setQueueName] = useState('');
  const [queueDesc, setQueueDesc] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [deletingQueue, setDeletingQueue] = useState<RevisionQueue | null>(null);

  useEffect(() => {
    if (queues.length > 0 && !queues.some((q) => q.id === selectedQueueId)) {
      setSelectedQueueId(queues[0].id);
    } else if (queues.length === 0) {
      setSelectedQueueId('');
    }
  }, [queues, selectedQueueId]);

  const recordingMap = useMemo(() => new Map(recordings.map((r) => [r.id, r])), [recordings]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const activeQueue = queues.find((q) => q.id === selectedQueueId) ?? null;

  const queueRecordings = useMemo(() => {
    if (!activeQueue) return [];
    return activeQueue.recordingIds
      .map((id) => recordingMap.get(id))
      .filter((r): r is Recording => Boolean(r));
  }, [activeQueue, recordingMap]);

  const completedSet = useMemo(
    () => new Set(activeQueue?.completedIds ?? []),
    [activeQueue?.completedIds],
  );

  const remainingRecordings = queueRecordings.filter((r) => !completedSet.has(r.id));
  const remainingDuration = remainingRecordings.reduce((s, r) => s + (r.duration || 0), 0);

  const pickerCandidates = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return recordings.filter((r) => {
      if (r.isArchived) return false;
      if (!q) return true;
      const subj = subjectMap.get(r.subjectId)?.name.toLowerCase() ?? '';
      const top = topicMap.get(r.topicId)?.name.toLowerCase() ?? '';
      return (
        r.title.toLowerCase().includes(q) ||
        subj.includes(q) ||
        top.includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [recordings, pickerQuery, subjectMap, topicMap]);

  const openCreateModal = () => {
    setEditingQueue(null);
    setQueueName('');
    setQueueDesc('');
    setQueueModalOpen(true);
  };

  const openEditModal = (q: RevisionQueue) => {
    setEditingQueue(q);
    setQueueName(q.name);
    setQueueDesc(q.description);
    setQueueModalOpen(true);
  };

  const handleSaveQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueName.trim()) return;
    if (editingQueue) {
      await updateRevisionQueue(editingQueue.id, {
        name: queueName.trim(),
        description: queueDesc.trim(),
      });
      showToast('Revision queue updated', 'success');
    } else {
      const created = await createRevisionQueue({
        name: queueName.trim(),
        description: queueDesc.trim(),
      });
      setSelectedQueueId(created.id);
      showToast('Revision queue created', 'success');
    }
    setQueueModalOpen(false);
  };

  const handlePlayQueue = async (startRec?: Recording) => {
    if (!activeQueue || queueRecordings.length === 0) return;
    const firstTarget = startRec ?? remainingRecordings[0] ?? queueRecordings[0];
    await playRecording(firstTarget, queueRecordings, {
      revisionQueueId: activeQueue.id,
      startAt: 0,
    });
  };

  const handleToggleComplete = async (recId: string) => {
    if (!activeQueue) return;
    const exists = completedSet.has(recId);
    const next = exists
      ? activeQueue.completedIds.filter((id) => id !== recId)
      : [...activeQueue.completedIds, recId];
    await updateRevisionQueue(activeQueue.id, { completedIds: next });
  };

  const handleMoveItem = async (index: number, direction: -1 | 1) => {
    if (!activeQueue) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= activeQueue.recordingIds.length) return;
    const nextIds = [...activeQueue.recordingIds];
    const [moved] = nextIds.splice(index, 1);
    nextIds.splice(targetIdx, 0, moved);
    await updateRevisionQueue(activeQueue.id, { recordingIds: nextIds });
  };

  const handleRemoveFromQueue = async (recId: string) => {
    if (!activeQueue) return;
    await updateRevisionQueue(activeQueue.id, {
      recordingIds: activeQueue.recordingIds.filter((id) => id !== recId),
      completedIds: activeQueue.completedIds.filter((id) => id !== recId),
    });
  };

  const handleToggleInPicker = async (recId: string) => {
    if (!activeQueue) return;
    const exists = activeQueue.recordingIds.includes(recId);
    const nextIds = exists
      ? activeQueue.recordingIds.filter((id) => id !== recId)
      : [...activeQueue.recordingIds, recId];
    await updateRevisionQueue(activeQueue.id, { recordingIds: nextIds });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Revision Mode
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Build focused playlists for exams and play explanations consecutively.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Queue</span>
        </button>
      </div>

      {queues.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] py-16 px-6 text-center">
          <ListMusic className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
          <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            No revision queues yet
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Create queues such as Mid-Semester Revision or Difficult Concepts to revise recordings back-to-back.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 min-h-[42px] px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span>Create Revision Queue</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Saved Queues List */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            <div className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
              Saved Queues ({queues.length})
            </div>
            {queues.map((q) => {
              const selected = q.id === activeQueue?.id;
              const done = q.completedIds.filter((id) => q.recordingIds.includes(id)).length;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedQueueId(q.id)}
                  className={`w-full px-4 py-3.5 text-left transition-colors ${
                    selected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div
                    className={`text-sm font-semibold truncate ${
                      selected
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {q.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {q.recordingIds.length} notes · {done} completed
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Queue Workspace */}
          {activeQueue && (
            <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {activeQueue.name}
                    </h2>
                    {activeQueue.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {activeQueue.description}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {remainingRecordings.length} remaining ·{' '}
                      {queueRecordings.length - remainingRecordings.length} completed ·{' '}
                      {formatHumanDuration(remainingDuration)} left
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(activeQueue)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      aria-label="Edit queue"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingQueue(activeQueue)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      aria-label="Delete queue"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={queueRecordings.length === 0}
                    onClick={() => handlePlayQueue()}
                    className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>
                      {remainingRecordings.length > 0 &&
                      remainingRecordings.length < queueRecordings.length
                        ? 'Resume Queue'
                        : 'Play Queue'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Recordings</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleShuffleQueue}
                    className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      shuffleQueue
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>Shuffle</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleRepeatCurrent}
                    className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      repeatCurrent
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    <span>Repeat One</span>
                  </button>

                  {activeQueue.completedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        await updateRevisionQueue(activeQueue.id, { completedIds: [] });
                        showToast('Queue progress reset', 'info');
                      }}
                      className="min-h-[40px] px-3 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Progress</span>
                    </button>
                  )}
                </div>
              </div>

              {queueRecordings.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This queue is empty. Add recordings from your library to build your revision session.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="mt-4 min-h-[40px] px-4 rounded-xl bg-indigo-600 text-white text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Select Recordings</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {queueRecordings.map((rec, index) => {
                    const done = completedSet.has(rec.id);
                    const isCurrent = currentRecording?.id === rec.id;
                    const subj = subjectMap.get(rec.subjectId);
                    const top = topicMap.get(rec.topicId);

                    return (
                      <div
                        key={rec.id}
                        className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 ${
                          isCurrent
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(rec.id)}
                          className={`h-6 w-6 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                            done
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 text-transparent hover:border-indigo-500'
                          }`}
                          aria-label={done ? 'Mark incomplete' : 'Mark completed'}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePlayQueue(rec)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div
                            className={`text-sm font-medium truncate ${
                              done
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : isCurrent
                                  ? 'text-indigo-700 dark:text-indigo-300'
                                  : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {rec.title}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                            {subj ? subj.name : ''}
                            {top ? ` / ${top.name}` : ''} ·{' '}
                            <span className="font-mono tabular-nums">
                              {formatDuration(rec.duration)}
                            </span>
                            {isCurrent && isPlaying ? ' · Playing' : ''}
                          </div>
                        </button>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveItem(index, -1)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === queueRecordings.length - 1}
                            onClick={() => handleMoveItem(index, 1)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(rec.id)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600"
                            aria-label="Remove from queue"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Queue Modal */}
      {queueModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setQueueModalOpen(false)}
        >
          <form
            onSubmit={handleSaveQueue}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingQueue ? 'Edit Revision Queue' : 'New Revision Queue'}
              </h3>
              <button
                type="button"
                onClick={() => setQueueModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Queue Name
              </label>
              <input
                type="text"
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                placeholder="e.g. End-Semester Revision"
                required
                autoFocus
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Description (optional)
              </label>
              <textarea
                value={queueDesc}
                onChange={(e) => setQueueDesc(e.target.value)}
                rows={2}
                placeholder="What this revision session focuses on..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQueueModalOpen(false)}
                className="min-h-[40px] px-4 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-4 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {editingQueue ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Recordings Picker Modal */}
      {pickerOpen && activeQueue && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Select Recordings for {activeQueue.name}
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search recordings by title, subject, or tag..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {pickerCandidates.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No matching recordings found.
                </div>
              ) : (
                pickerCandidates.map((rec) => {
                  const selected = activeQueue.recordingIds.includes(rec.id);
                  const subj = subjectMap.get(rec.subjectId);
                  const top = topicMap.get(rec.topicId);
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => handleToggleInPicker(rec.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {rec.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {subj?.name}
                          {top ? ` / ${top.name}` : ''} ·{' '}
                          <span className="font-mono tabular-nums">
                            {formatDuration(rec.duration)}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`h-6 w-6 shrink-0 rounded-md border flex items-center justify-center ${
                          selected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-700 text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="min-h-[40px] px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingQueue}
        title="Delete revision queue?"
        description={`"${deletingQueue?.name ?? ''}" will be removed. Your recordings in the library will not be deleted.`}
        confirmLabel="Delete Queue"
        destructive
        onConfirm={async () => {
          if (deletingQueue) {
            await deleteRevisionQueue(deletingQueue.id);
            showToast('Revision queue deleted', 'info');
            setDeletingQueue(null);
          }
        }}
        onCancel={() => setDeletingQueue(null)}
      />
    </div>
  );
};
