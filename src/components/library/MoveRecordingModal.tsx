import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Recording } from '../../types/recording';
import type { Subject } from '../../types/subject';
import type { Topic } from '../../types/topic';

interface MoveRecordingModalProps {
  recording: Recording | null;
  subjects: Subject[];
  topics: Topic[];
  onClose: () => void;
  onMove: (recordingId: string, subjectId: string, topicId: string) => Promise<void>;
}

export const MoveRecordingModal: React.FC<MoveRecordingModalProps> = ({
  recording,
  subjects,
  topics,
  onClose,
  onMove,
}) => {
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [moving, setMoving] = useState(false);

  const activeSubjects = subjects.filter((s) => !s.isArchived);

  useEffect(() => {
    if (!recording) return;
    setSubjectId(recording.subjectId);
    setTopicId(recording.topicId);
  }, [recording]);

  const filteredTopics = topics.filter((t) => t.subjectId === subjectId && !t.isArchived);

  useEffect(() => {
    if (filteredTopics.length > 0 && !filteredTopics.some((t) => t.id === topicId)) {
      setTopicId(filteredTopics[0].id);
    } else if (filteredTopics.length === 0) {
      setTopicId('');
    }
  }, [subjectId, filteredTopics, topicId]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recording, onClose]);

  if (!recording) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !topicId || moving) return;
    setMoving(true);
    try {
      await onMove(recording.id, subjectId, topicId);
      onClose();
    } finally {
      setMoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Move Recording
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
              {recording.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Target Subject
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Target Topic
            </label>
            {filteredTopics.length > 0 ? (
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {filteredTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 py-2">
                This subject has no active topics yet. Create a topic inside it first.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!topicId || moving}
            className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {moving ? 'Moving...' : 'Move Recording'}
          </button>
        </div>
      </form>
    </div>
  );
};
