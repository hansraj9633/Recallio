import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  Edit3,
  FolderPlus,
  LayoutGrid,
  List,
  MoreHorizontal,
  Search,
  Trash2,
} from 'lucide-react';
import type { Recording } from '../types/recording';
import type { Subject, SubjectColor, SubjectIcon } from '../types/subject';
import type { Topic } from '../types/topic';
import {
  createSubject,
  deleteSubjectCascade,
  emptyTrash,
  permanentlyDeleteRecording,
  restoreRecording,
  updateSubject,
} from '../services/libraryService';
import { exportBackupArchive } from '../services/backupService';
import { formatHumanDuration, formatRelativeDate } from '../utils/formatTime';
import { SubjectIconMark } from '../components/common/SubjectIconMark';
import { SubjectModal } from '../components/library/SubjectModal';
import { RecordingRow } from '../components/library/RecordingRow';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

interface LibraryProps {
  subjects: Subject[];
  topics: Topic[];
  recordings: Recording[];
  trashedRecordings: Recording[];
  onSelectSubject: (subjectId: string) => void;
  onOpenSearch: () => void;
}

type LibraryTab = 'active' | 'archived' | 'trash';

export const Library: React.FC<LibraryProps> = ({
  subjects,
  topics,
  recordings,
  trashedRecordings,
  onSelectSubject,
  onOpenSearch,
}) => {
  const { showToast } = useToast();

  const [tab, setTab] = useState<LibraryTab>('active');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'recordings'>('updated');

  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [permDeletingRec, setPermDeletingRec] = useState<Recording | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  useEffect(() => {
    if (!menuOpenId) return;
    const handleDocClick = () => setMenuOpenId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [menuOpenId]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const subjectStats = useMemo(() => {
    const map = new Map<
      string,
      { topicCount: number; recordingCount: number; duration: number; lastUpdated: number }
    >();
    for (const s of subjects) {
      map.set(s.id, {
        topicCount: 0,
        recordingCount: 0,
        duration: 0,
        lastUpdated: s.updatedAt,
      });
    }
    for (const t of topics) {
      if (t.isArchived) continue;
      const entry = map.get(t.subjectId);
      if (entry) {
        entry.topicCount++;
        if (t.updatedAt > entry.lastUpdated) entry.lastUpdated = t.updatedAt;
      }
    }
    for (const r of recordings) {
      if (r.isArchived) continue;
      const entry = map.get(r.subjectId);
      if (entry) {
        entry.recordingCount++;
        entry.duration += r.duration || 0;
        if (r.updatedAt > entry.lastUpdated) entry.lastUpdated = r.updatedAt;
      }
    }
    return map;
  }, [subjects, topics, recordings]);

  const visibleSubjects = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const list = subjects.filter((s) => {
      if (tab === 'active' && s.isArchived) return false;
      if (tab === 'archived' && !s.isArchived) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const sa = subjectStats.get(a.id);
      const sb = subjectStats.get(b.id);
      if (sortBy === 'recordings') return (sb?.recordingCount ?? 0) - (sa?.recordingCount ?? 0);
      return (sb?.lastUpdated ?? b.updatedAt) - (sa?.lastUpdated ?? a.updatedAt);
    });
  }, [subjects, tab, filterText, sortBy, subjectStats]);

  const handleSaveSubject = async (data: {
    name: string;
    color: SubjectColor;
    icon: SubjectIcon;
  }) => {
    if (editingSubject) {
      await updateSubject(editingSubject.id, data);
      showToast('Subject updated', 'success');
    } else {
      await createSubject(data);
      showToast('Subject created', 'success');
    }
    setEditingSubject(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Library
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Organise voice notes by subject and topic.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Search className="h-4 w-4 text-slate-400" />
            <span>Search all</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingSubject(null);
              setSubjectModalOpen(true);
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <FolderPlus className="h-4 w-4" />
            <span>New Subject</span>
          </button>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 self-start">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === 'active'
                ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Subjects
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === 'archived'
                ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Archived
          </button>
          <button
            type="button"
            onClick={() => setTab('trash')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === 'trash'
                ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Recently Deleted ({trashedRecordings.length})
          </button>
        </div>

        {tab !== 'trash' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter subjects..."
              className="min-h-[38px] w-full sm:w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'updated' | 'name' | 'recordings')}
              aria-label="Sort subjects"
              className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="updated">Recently updated</option>
              <option value="name">Alphabetical</option>
              <option value="recordings">Most recordings</option>
            </select>

            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subjects Tab / Archived Tab */}
      {tab !== 'trash' ? (
        visibleSubjects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] py-16 px-6 text-center">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {tab === 'archived' ? 'No archived subjects' : 'No subjects found'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {tab === 'archived'
                ? 'Subjects you archive after completing exams will appear here.'
                : 'Create a subject such as Civil Engineering or Biochemistry to organise your voice explanations.'}
            </p>
            {tab === 'active' && (
              <button
                type="button"
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectModalOpen(true);
                }}
                className="mt-5 min-h-[42px] px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-indigo-700"
              >
                <FolderPlus className="h-4 w-4" />
                <span>Create First Subject</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleSubjects.map((subj) => {
              const st = subjectStats.get(subj.id) ?? {
                topicCount: 0,
                recordingCount: 0,
                duration: 0,
                lastUpdated: subj.updatedAt,
              };
              return (
                <div
                  key={subj.id}
                  className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectSubject(subj.id)}
                      className="flex items-center gap-3.5 text-left min-w-0 flex-1"
                    >
                      <SubjectIconMark icon={subj.icon} color={subj.color} size="lg" />
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {subj.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Updated {formatRelativeDate(st.lastUpdated)}
                        </p>
                      </div>
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === subj.id ? null : subj.id);
                        }}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                        aria-label={`Actions for ${subj.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {menuOpenId === subj.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 z-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] py-1.5 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              setEditingSubject(subj);
                              setSubjectModalOpen(true);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="h-4 w-4 text-slate-400" />
                            <span>Edit subject</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setMenuOpenId(null);
                              await exportBackupArchive(subj.id);
                              showToast(`Exported "${subj.name}" backup`, 'success');
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Download className="h-4 w-4 text-slate-400" />
                            <span>Export subject</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setMenuOpenId(null);
                              await updateSubject(subj.id, { isArchived: !subj.isArchived });
                              showToast(
                                subj.isArchived ? 'Subject restored' : 'Subject archived',
                                'info',
                              );
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Archive className="h-4 w-4 text-slate-400" />
                            <span>{subj.isArchived ? 'Unarchive' : 'Archive'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              setDeletingSubject(subj);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete subject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectSubject(subj.id)}
                    className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 w-full flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
                  >
                    <span className="tabular-nums">
                      {st.topicCount} {st.topicCount === 1 ? 'topic' : 'topics'} · {st.recordingCount}{' '}
                      {st.recordingCount === 1 ? 'note' : 'notes'}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                      {formatHumanDuration(st.duration)}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
            {visibleSubjects.map((subj) => {
              const st = subjectStats.get(subj.id) ?? {
                topicCount: 0,
                recordingCount: 0,
                duration: 0,
                lastUpdated: subj.updatedAt,
              };
              return (
                <div
                  key={subj.id}
                  className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <button
                    type="button"
                    onClick={() => onSelectSubject(subj.id)}
                    className="flex items-center gap-3.5 text-left min-w-0 flex-1"
                  >
                    <SubjectIconMark icon={subj.icon} color={subj.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {subj.name}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {st.topicCount} topics · {st.recordingCount} recordings ·{' '}
                        {formatHumanDuration(st.duration)} · Updated{' '}
                        {formatRelativeDate(st.lastUpdated)}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubject(subj);
                        setSubjectModalOpen(true);
                      }}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      aria-label={`Edit ${subj.name}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSubject(subj)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      aria-label={`Delete ${subj.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Recently Deleted (Trash) */
        <div className="space-y-4">
          {trashedRecordings.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deleted recordings can be restored to their original topic or permanently removed.
              </p>
              <button
                type="button"
                onClick={() => setConfirmEmptyTrash(true)}
                className="min-h-[38px] px-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-medium hover:bg-rose-100 dark:hover:bg-rose-900/60 whitespace-nowrap shrink-0"
              >
                Empty Trash
              </button>
            </div>
          )}

          {trashedRecordings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] py-16 px-6 text-center">
              <Trash2 className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
              <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Recently Deleted is empty
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Recordings you delete will appear here first so nothing is lost accidentally.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
              {trashedRecordings.map((rec) => (
                <RecordingRow
                  key={rec.id}
                  recording={rec}
                  subject={subjectMap.get(rec.subjectId)}
                  topic={topicMap.get(rec.topicId)}
                  onToggleFavourite={() => {}}
                  onRestore={async (r) => {
                    await restoreRecording(r.id);
                    showToast('Recording restored', 'success');
                  }}
                  onPermanentDelete={setPermDeletingRec}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <SubjectModal
        open={subjectModalOpen}
        initial={editingSubject}
        onClose={() => {
          setSubjectModalOpen(false);
          setEditingSubject(null);
        }}
        onSave={handleSaveSubject}
      />

      <ConfirmDialog
        open={!!deletingSubject}
        title="Delete subject and all its topics?"
        description={`Deleting "${deletingSubject?.name ?? ''}" will permanently remove all its topics, recordings, and bookmarks from this device.`}
        confirmLabel="Delete Subject"
        destructive
        onConfirm={async () => {
          if (deletingSubject) {
            await deleteSubjectCascade(deletingSubject.id);
            showToast('Subject deleted', 'info');
            setDeletingSubject(null);
          }
        }}
        onCancel={() => setDeletingSubject(null)}
      />

      <ConfirmDialog
        open={!!permDeletingRec}
        title="Permanently delete recording?"
        description={`"${permDeletingRec?.title ?? ''}" and its audio data will be permanently erased and cannot be recovered.`}
        confirmLabel="Delete Forever"
        destructive
        onConfirm={async () => {
          if (permDeletingRec) {
            await permanentlyDeleteRecording(permDeletingRec.id);
            showToast('Recording permanently deleted', 'info');
            setPermDeletingRec(null);
          }
        }}
        onCancel={() => setPermDeletingRec(null)}
      />

      <ConfirmDialog
        open={confirmEmptyTrash}
        title="Empty Recently Deleted?"
        description={`All ${trashedRecordings.length} deleted recordings will be permanently erased.`}
        confirmLabel="Empty Trash"
        destructive
        onConfirm={async () => {
          await emptyTrash();
          showToast('Trash emptied', 'info');
          setConfirmEmptyTrash(false);
        }}
        onCancel={() => setConfirmEmptyTrash(false)}
      />
    </div>
  );
};
