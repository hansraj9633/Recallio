import React, { useEffect, useMemo, useState } from 'react';
import { Play, Search, X } from 'lucide-react';
import type { Recording, RecordingFilter, RecordingSort } from '../../types/recording';
import type { Subject } from '../../types/subject';
import type { Topic } from '../../types/topic';
import { formatDuration, formatRelativeDate } from '../../utils/formatTime';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

interface SearchModalProps {
  open: boolean;
  recordings: Recording[];
  subjects: Subject[];
  topics: Topic[];
  onClose: () => void;
  onNavigateSubject: (subjectId: string) => void;
  onNavigateTopic: (subjectId: string, topicId: string) => void;
}

const FILTERS: { id: RecordingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recent_added', label: 'Recently Added' },
  { id: 'recent_played', label: 'Recently Played' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'most_played', label: 'Most Played' },
  { id: 'never_played', label: 'Never Played' },
  { id: 'archived', label: 'Archived' },
];

export const SearchModal: React.FC<SearchModalProps> = ({
  open,
  recordings,
  subjects,
  topics,
  onClose,
  onNavigateSubject,
  onNavigateTopic,
}) => {
  const { playRecording } = useAudioPlayer();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecordingFilter>('all');
  const [sort, setSort] = useState<RecordingSort>('newest');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const matchedSubjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return subjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, subjects]);

  const matchedTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return topics.filter((t) => t.name.toLowerCase().includes(q));
  }, [query, topics]);

  const filteredRecordings = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;

    let list = recordings.filter((rec) => {
      if (filter === 'archived') {
        if (!rec.isArchived) return false;
      } else {
        if (rec.isArchived) return false;
      }

      if (filter === 'recent_added' && rec.createdAt < sevenDaysAgo) return false;
      if (filter === 'recent_played' && !rec.lastPlayedAt) return false;
      if (filter === 'favourites' && !rec.isFavourite) return false;
      if (filter === 'most_played' && rec.playCount === 0) return false;
      if (filter === 'never_played' && rec.playCount > 0) return false;

      if (!q) return true;
      const subj = subjectMap.get(rec.subjectId)?.name.toLowerCase() ?? '';
      const top = topicMap.get(rec.topicId)?.name.toLowerCase() ?? '';
      return (
        rec.title.toLowerCase().includes(q) ||
        rec.description.toLowerCase().includes(q) ||
        rec.tags.some((t) => t.toLowerCase().includes(q)) ||
        subj.includes(q) ||
        top.includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      if (filter === 'recent_played') {
        return (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0);
      }
      if (filter === 'most_played') {
        return b.playCount - a.playCount;
      }
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

    return list;
  }, [recordings, filter, sort, query, subjectMap, topicMap]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 backdrop-blur-[2px] p-3 sm:p-6 pt-8 sm:pt-16"
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects, topics, recordings, descriptions, or tags..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Esc
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filter === f.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as RecordingSort)}
            aria-label="Sort recordings"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="longest">Longest duration</option>
            <option value="shortest">Shortest duration</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {(matchedSubjects.length > 0 || matchedTopics.length > 0) && (
            <div className="px-4 py-3 space-y-2">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Matching Subjects & Topics
              </div>
              <div className="flex flex-wrap gap-2">
                {matchedSubjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onNavigateSubject(s.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {s.name}
                  </button>
                ))}
                {matchedTopics.map((t) => {
                  const s = subjectMap.get(t.subjectId);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onNavigateTopic(t.subjectId, t.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {s ? `${s.name} / ` : ''}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredRecordings.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching recordings found.
            </div>
          ) : (
            filteredRecordings.map((rec) => {
              const subj = subjectMap.get(rec.subjectId);
              const top = topicMap.get(rec.topicId);
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    playRecording(rec, filteredRecordings);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <Play className="h-4 w-4 ml-0.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {rec.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {subj && (
                        <span className="truncate">
                          {subj.name}
                          {top ? ` / ${top.name}` : ''}
                        </span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatDuration(rec.duration)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeDate(rec.createdAt)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
