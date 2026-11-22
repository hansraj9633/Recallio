import React, { useEffect, useState } from 'react';
import { Check, ListPlus, Plus, X } from 'lucide-react';
import type { Recording } from '../../types/recording';
import type { RevisionQueue } from '../../types/revision';
import { createRevisionQueue, updateRevisionQueue } from '../../services/libraryService';
import { useToast } from '../common/Toast';

interface AddToQueueModalProps {
  recording: Recording | null;
  queues: RevisionQueue[];
  onClose: () => void;
}

export const AddToQueueModal: React.FC<AddToQueueModalProps> = ({
  recording,
  queues,
  onClose,
}) => {
  const { showToast } = useToast();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recording, onClose]);

  if (!recording) return null;

  const handleToggleQueue = async (q: RevisionQueue) => {
    const exists = q.recordingIds.includes(recording.id);
    const nextIds = exists
      ? q.recordingIds.filter((id) => id !== recording.id)
      : [...q.recordingIds, recording.id];
    await updateRevisionQueue(q.id, { recordingIds: nextIds });
    showToast(exists ? `Removed from "${q.name}"` : `Added to "${q.name}"`, 'success');
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createRevisionQueue({
        name: newName.trim(),
        recordingIds: [recording.id],
      });
      setNewName('');
      showToast(`Created "${created.name}" with recording`, 'success');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Add to Revision Queue
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

        <div className="mt-4 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
          {queues.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
              No revision queues yet. Create one below.
            </div>
          ) : (
            queues.map((q) => {
              const inQueue = q.recordingIds.includes(recording.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleToggleQueue(q)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {q.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {q.recordingIds.length} recordings
                    </div>
                  </div>
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                      inQueue
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-700 text-transparent'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <form onSubmit={handleCreateQueue} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New queue name..."
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!newName.trim() || creating}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create</span>
          </button>
        </form>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5"
          >
            <ListPlus className="h-4 w-4" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
