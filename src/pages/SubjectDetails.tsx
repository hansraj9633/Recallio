import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Download,
  Edit3,
  FolderPlus,
  Mic,
  Trash2,
} from 'lucide-react';
import type { Recording } from '../types/recording';
import type { Subject, SubjectColor, SubjectIcon } from '../types/subject';
import type { Topic } from '../types/topic';
import {
  createTopic,
  deleteTopicCascade,
  updateSubject,
  updateTopic,
} from '../services/libraryService';
import { exportBackupArchive } from '../services/backupService';
import { formatHumanDuration, formatRelativeDate } from '../utils/formatTime';
import { SubjectIconMark } from '../components/common/SubjectIconMark';
import { SubjectModal } from '../components/library/SubjectModal';
import { TopicModal } from '../components/library/TopicModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

interface SubjectDetailsProps {
  subject: Subject;
  topics: Topic[];
  recordings: Recording[];
  onBack: () => void;
  onSelectTopic: (topicId: string) => void;
  onRecordInSubject: (subjectId: string) => void;
}

export const SubjectDetails: React.FC<SubjectDetailsProps> = ({
  subject,
  topics,
  recordings,
  onBack,
  onSelectTopic,
  onRecordInSubject,
}) => {
  const { showToast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null);

  const visibleTopics = useMemo(
    () => topics.filter((t) => (showArchived ? t.isArchived : !t.isArchived)),
    [topics, showArchived],
  );

  const topicStats = useMemo(() => {
    const map = new Map<string, { count: number; duration: number }>();
    for (const r of recordings) {
      if (r.isArchived) continue;
      const cur = map.get(r.topicId) ?? { count: 0, duration: 0 };
      cur.count++;
      cur.duration += r.duration || 0;
      map.set(r.topicId, cur);
    }
    return map;
  }, [recordings]);

  const totalDuration = recordings.reduce((s, r) => s + (r.duration || 0), 0);

  const handleSaveSubject = async (data: {
    name: string;
    color: SubjectColor;
    icon: SubjectIcon;
  }) => {
    await updateSubject(subject.id, data);
    showToast('Subject updated', 'success');
  };

  const handleSaveTopic = async (data: { name: string; description: string }) => {
    if (editingTopic) {
      await updateTopic(editingTopic.id, data);
      showToast('Topic updated', 'success');
    } else {
      await createTopic({ subjectId: subject.id, ...data });
      showToast('Topic created', 'success');
    }
    setEditingTopic(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Library</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <SubjectIconMark icon={subject.icon} color={subject.color} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 truncate">
                {subject.name}
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {topics.filter((t) => !t.isArchived).length} topics · {recordings.length} recordings ·{' '}
                {formatHumanDuration(totalDuration)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditSubjectOpen(true)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await exportBackupArchive(subject.id);
                showToast(`Exported "${subject.name}" archive`, 'success');
              }}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingTopic(null);
                setTopicModalOpen(true);
              }}
              className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>Add Topic</span>
            </button>

            <button
              type="button"
              onClick={() => onRecordInSubject(subject.id)}
              className="min-h-[40px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Record</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Active vs Archived Topics */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Topics</h2>
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {showArchived ? 'Show Active Topics' : 'Show Archived Topics'}
        </button>
      </div>

      {visibleTopics.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] py-14 px-6 text-center">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {showArchived ? 'No archived topics' : 'No topics yet'}
          </h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {showArchived
              ? 'Topics you archive inside this subject will appear here.'
              : 'Add topics to organize your recordings by chapter or syllabus module.'}
          </p>
          {!showArchived && (
            <button
              type="button"
              onClick={() => {
                setEditingTopic(null);
                setTopicModalOpen(true);
              }}
              className="mt-4 min-h-[42px] px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-indigo-700"
            >
              <FolderPlus className="h-4 w-4" />
              <span>Add First Topic</span>
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
          {visibleTopics.map((topic) => {
            const st = topicStats.get(topic.id) ?? { count: 0, duration: 0 };
            return (
              <div
                key={topic.id}
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectTopic(topic.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {topic.name}
                  </div>
                  {topic.description && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {topic.description}
                    </p>
                  )}
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {st.count} {st.count === 1 ? 'recording' : 'recordings'} ·{' '}
                    {formatHumanDuration(st.duration)} · Updated{' '}
                    {formatRelativeDate(topic.updatedAt)}
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTopic(topic);
                      setTopicModalOpen(true);
                    }}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    aria-label={`Edit topic ${topic.name}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateTopic(topic.id, { isArchived: !topic.isArchived });
                      showToast(topic.isArchived ? 'Topic restored' : 'Topic archived', 'info');
                    }}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    aria-label={topic.isArchived ? 'Unarchive topic' : 'Archive topic'}
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingTopic(topic)}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    aria-label={`Delete topic ${topic.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTopic(topic.id)}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600"
                    aria-label={`Open ${topic.name}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SubjectModal
        open={editSubjectOpen}
        initial={subject}
        onClose={() => setEditSubjectOpen(false)}
        onSave={handleSaveSubject}
      />

      <TopicModal
        open={topicModalOpen}
        initial={editingTopic}
        subjectName={subject.name}
        onClose={() => {
          setTopicModalOpen(false);
          setEditingTopic(null);
        }}
        onSave={handleSaveTopic}
      />

      <ConfirmDialog
        open={!!deletingTopic}
        title="Delete topic and its recordings?"
        description={`Deleting "${deletingTopic?.name ?? ''}" will permanently remove all recordings and bookmarks inside this topic.`}
        confirmLabel="Delete Topic"
        destructive
        onConfirm={async () => {
          if (deletingTopic) {
            await deleteTopicCascade(deletingTopic.id);
            showToast('Topic deleted', 'info');
            setDeletingTopic(null);
          }
        }}
        onCancel={() => setDeletingTopic(null)}
      />
    </div>
  );
};
