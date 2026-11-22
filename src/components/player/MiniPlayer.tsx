import React from 'react';
import {
  ChevronUp,
  Heart,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  X,
} from 'lucide-react';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useSubjects, useTopics, useUserSettings } from '../../hooks/useSubjects';
import { updateRecording } from '../../services/libraryService';
import { formatDuration } from '../../utils/formatTime';

export const MiniPlayer: React.FC = () => {
  const {
    currentRecording,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    playbackSpeed,
    togglePlayPause,
    skipBy,
    setExpanded,
    closePlayer,
  } = useAudioPlayer();

  const subjects = useSubjects();
  const topics = useTopics();
  const settings = useUserSettings();

  if (!currentRecording) return null;

  const subject = subjects.find((s) => s.id === currentRecording.subjectId);
  const topic = topics.find((t) => t.id === currentRecording.topicId);
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleToggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateRecording(currentRecording.id, {
      isFavourite: !currentRecording.isFavourite,
    });
  };

  return (
    <div className="fixed left-0 right-0 md:left-64 bottom-14 md:bottom-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md">
      {/* Thin Progress Line */}
      <div className="h-0.5 w-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-indigo-600 dark:bg-indigo-400 transition-[width] duration-150"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        {/* Clickable Track Info to open Expanded Player */}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none group"
          aria-label="Open expanded audio player"
        >
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <ChevronUp className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {currentRecording.title}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              {subject && (
                <span className="truncate">
                  {subject.name}
                  {topic ? ` / ${topic.name}` : ''}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums shrink-0">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
              {playbackSpeed !== 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums shrink-0">{playbackSpeed}x</span>
                </>
              )}
            </div>
          </div>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => skipBy(-settings.defaultSkipInterval)}
            className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={`Skip backward ${settings.defaultSkipInterval} seconds`}
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            disabled={isLoading}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 transition-colors disabled:opacity-50"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => skipBy(settings.defaultSkipInterval)}
            className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={`Skip forward ${settings.defaultSkipInterval} seconds`}
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleFav}
            className={`hidden md:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg transition-colors ${
              currentRecording.isFavourite
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            aria-label={currentRecording.isFavourite ? 'Unfavourite' : 'Favourite'}
          >
            <Heart className={`h-4 w-4 ${currentRecording.isFavourite ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="sm:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            aria-label="Expand player"
          >
            <ChevronUp className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={closePlayer}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
