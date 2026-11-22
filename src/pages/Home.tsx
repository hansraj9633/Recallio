import React, { useMemo } from 'react';
import { ArrowRight, Heart, Library, Mic, Play } from 'lucide-react';
import type { Recording } from '../types/recording';
import type { Subject } from '../types/subject';
import type { Topic } from '../types/topic';
import type { RevisionActivity } from '../types/revision';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { updateRecording } from '../services/libraryService';
import {
  formatDuration,
  formatHumanDuration,
  formatRelativeDate,
  toDateKey,
} from '../utils/formatTime';
import { RecordingRow } from '../components/library/RecordingRow';

interface HomeProps {
  subjects: Subject[];
  topics: Topic[];
  recordings: Recording[];
  activity: RevisionActivity[];
  onQuickRecord: () => void;
  onOpenLibrary: () => void;
  onAddToQueue: (rec: Recording) => void;
}

export const Home: React.FC<HomeProps> = ({
  subjects,
  topics,
  recordings,
  activity,
  onQuickRecord,
  onOpenLibrary,
  onAddToQueue,
}) => {
  const { playRecording } = useAudioPlayer();

  const activeSubjects = useMemo(() => subjects.filter((s) => !s.isArchived), [subjects]);
  const activeTopics = useMemo(() => topics.filter((t) => !t.isArchived), [topics]);
  const activeRecordings = useMemo(() => recordings.filter((r) => !r.isArchived), [recordings]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const totalDuration = useMemo(
    () => activeRecordings.reduce((sum, r) => sum + (r.duration || 0), 0),
    [activeRecordings],
  );

  // Greeting & current date
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Continue Listening: most recently played recording with unfinished progress, or most recently played
  const continueListening = useMemo(() => {
    const inProgress = activeRecordings
      .filter((r) => r.lastPosition > 1 && r.lastPosition < Math.max(0, r.duration - 1.5))
      .sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt));
    if (inProgress.length > 0) return inProgress[0];
    return activeRecordings
      .filter((r) => r.lastPlayedAt !== null)
      .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))[0] ?? null;
  }, [activeRecordings]);

  const recentlyAdded = useMemo(
    () => [...activeRecordings].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4),
    [activeRecordings],
  );

  const recentlyPlayed = useMemo(
    () =>
      activeRecordings
        .filter((r) => r.lastPlayedAt !== null)
        .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
        .slice(0, 4),
    [activeRecordings],
  );

  const favourites = useMemo(
    () => activeRecordings.filter((r) => r.isFavourite).slice(0, 4),
    [activeRecordings],
  );

  // 7-day weekly revision activity
  const weeklyDays = useMemo(() => {
    const map = new Map(activity.map((a) => [a.date, a]));
    const days: { dateKey: string; label: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = toDateKey(d);
      const entry = map.get(key);
      const totalSeconds = (entry?.recordedSeconds ?? 0) + (entry?.listenedSeconds ?? 0);
      days.push({
        dateKey: key,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
        minutes: Math.round(totalSeconds / 60),
      });
    }
    return days;
  }, [activity]);

  const maxWeeklyMinutes = Math.max(10, ...weeklyDays.map((d) => d.minutes));
  const totalWeeklyMinutes = weeklyDays.reduce((s, d) => s + d.minutes, 0);

  const handleToggleFavourite = async (rec: Recording) => {
    await updateRecording(rec.id, { isFavourite: !rec.isFavourite });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6 sm:py-8 space-y-8">
      {/* Hero Greeting + Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {formattedDate}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            {greeting}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Library className="h-4 w-4 text-slate-500" />
            <span>Library</span>
          </button>
          <button
            type="button"
            onClick={onQuickRecord}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Mic className="h-4 w-4" />
            <span>Quick Record</span>
          </button>
        </div>
      </div>

      {/* Concise Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Subjects</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {activeSubjects.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Topics</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {activeTopics.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Recordings</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {activeRecordings.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Audio</div>
          <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatHumanDuration(totalDuration)}
          </div>
        </div>
      </div>

      {/* Continue Listening + Weekly Revision Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Continue Listening
              </h2>
              {continueListening && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {continueListening.lastPlayedAt
                    ? `Played ${formatRelativeDate(continueListening.lastPlayedAt)}`
                    : 'Ready to play'}
                </span>
              )}
            </div>

            {continueListening ? (
              <div className="mt-4">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                  {continueListening.title}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {subjectMap.get(continueListening.subjectId)?.name}
                  {topicMap.get(continueListening.topicId)
                    ? ` / ${topicMap.get(continueListening.topicId)?.name}`
                    : ''}
                </div>

                {continueListening.description && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    {continueListening.description}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                Record your first explanation or pick a topic from your library to begin revising.
              </div>
            )}
          </div>

          {continueListening ? (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mb-1.5">
                  <span>{formatDuration(continueListening.lastPosition)}</span>
                  <span>{formatDuration(continueListening.duration)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full"
                    style={{
                      width: `${
                        continueListening.duration > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (continueListening.lastPosition / continueListening.duration) * 100,
                              ),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => playRecording(continueListening, activeRecordings)}
                className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <Play className="h-4 w-4 ml-0.5" />
                <span>Resume</span>
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <button
                type="button"
                onClick={onQuickRecord}
                className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium inline-flex items-center gap-2"
              >
                <Mic className="h-4 w-4" />
                <span>Start Recording</span>
              </button>
            </div>
          )}
        </div>

        {/* Weekly Revision Activity */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Weekly Activity
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {totalWeeklyMinutes}m this week
            </span>
          </div>

          <div className="mt-6 flex items-end justify-between gap-2 h-32 pt-4">
            {weeklyDays.map((day) => {
              const heightPct = day.minutes > 0 ? Math.max(12, Math.round((day.minutes / maxWeeklyMinutes) * 100)) : 6;
              return (
                <div key={day.dateKey} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {day.minutes > 0 ? `${day.minutes}m` : ''}
                  </span>
                  <div className="w-full max-w-[28px] flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        day.minutes > 0
                          ? 'bg-indigo-600 dark:bg-indigo-400'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${day.dateKey}: ${day.minutes} min`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recently Added & Recently Played */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recently Added
            </h2>
            <button
              type="button"
              onClick={onOpenLibrary}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>All notes</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recentlyAdded.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No recordings yet. Tap Quick Record to create your first note.
            </div>
          ) : (
            <div>
              {recentlyAdded.map((rec) => (
                <RecordingRow
                  key={rec.id}
                  recording={rec}
                  subject={subjectMap.get(rec.subjectId)}
                  topic={topicMap.get(rec.topicId)}
                  queueContext={recentlyAdded}
                  onToggleFavourite={handleToggleFavourite}
                  onAddToQueue={onAddToQueue}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recently Played
            </h2>
          </div>
          {recentlyPlayed.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Recordings you listen to will appear here for quick replay.
            </div>
          ) : (
            <div>
              {recentlyPlayed.map((rec) => (
                <RecordingRow
                  key={rec.id}
                  recording={rec}
                  subject={subjectMap.get(rec.subjectId)}
                  topic={topicMap.get(rec.topicId)}
                  queueContext={recentlyPlayed}
                  onToggleFavourite={handleToggleFavourite}
                  onAddToQueue={onAddToQueue}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Favourite Recordings */}
      {favourites.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500 fill-current" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Favourites
              </h2>
            </div>
          </div>
          <div>
            {favourites.map((rec) => (
              <RecordingRow
                key={rec.id}
                recording={rec}
                subject={subjectMap.get(rec.subjectId)}
                topic={topicMap.get(rec.topicId)}
                queueContext={favourites}
                onToggleFavourite={handleToggleFavourite}
                onAddToQueue={onAddToQueue}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
