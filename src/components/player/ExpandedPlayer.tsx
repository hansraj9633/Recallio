import React, { useEffect, useState } from 'react';
import {
  Bookmark as BookmarkIcon,
  ChevronDown,
  Heart,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useBookmarks, useSubjects, useTopics, useUserSettings } from '../../hooks/useSubjects';
import { addBookmark, deleteBookmark, updateRecording } from '../../services/libraryService';
import { PLAYBACK_SPEEDS } from '../../types/settings';
import { formatDuration } from '../../utils/formatTime';
import { isVolumeControlSupported } from '../../utils/storage';
import { WaveformScrubber } from './WaveformScrubber';
import { useToast } from '../common/Toast';

export const ExpandedPlayer: React.FC = () => {
  const {
    currentRecording,
    queue,
    queueIndex,
    waveformPeaks,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
    playbackSpeed,
    volume,
    isMuted,
    repeatCurrent,
    shuffleQueue,
    abRepeat,
    isExpanded,
    togglePlayPause,
    seek,
    skipBy,
    setPlaybackSpeed,
    setVolume,
    toggleMute,
    toggleRepeatCurrent,
    toggleShuffleQueue,
    playNext,
    playPrevious,
    setPointA,
    setPointB,
    clearABRepeat,
    setExpanded,
  } = useAudioPlayer();

  const settings = useUserSettings();
  const subjects = useSubjects();
  const topics = useTopics();
  const bookmarks = useBookmarks(currentRecording?.id);
  const { showToast } = useToast();

  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [addingBookmark, setAddingBookmark] = useState(false);

  const volumeSupported = isVolumeControlSupported();

  useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExpanded, setExpanded]);

  if (!isExpanded || !currentRecording) return null;

  const subject = subjects.find((s) => s.id === currentRecording.subjectId);
  const topic = topics.find((t) => t.id === currentRecording.topicId);
  const skipSecs = settings.defaultSkipInterval || 10;

  const handleToggleFav = async () => {
    await updateRecording(currentRecording.id, {
      isFavourite: !currentRecording.isFavourite,
    });
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addingBookmark) return;
    setAddingBookmark(true);
    try {
      await addBookmark({
        recordingId: currentRecording.id,
        timestamp: currentTime,
        label: bookmarkLabel.trim() || `Moment at ${formatDuration(currentTime)}`,
      });
      setBookmarkLabel('');
      showToast('Bookmark added', 'success');
    } finally {
      setAddingBookmark(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0B0F17] md:bg-slate-950/60 md:backdrop-blur-sm md:items-center md:justify-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded audio player"
      onClick={() => setExpanded(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-[#111827] md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-2xl md:border md:border-slate-200 md:dark:border-slate-800 md:shadow-2xl"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="min-h-[40px] px-2 -ml-2 flex items-center gap-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronDown className="h-5 w-5" />
            <span>Minimize</span>
          </button>

          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">
            {subject ? `${subject.name}${topic ? ` / ${topic.name}` : ''}` : 'Voice Note'}
          </div>

          <button
            type="button"
            onClick={handleToggleFav}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
              currentRecording.isFavourite
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            aria-label={currentRecording.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart className={`h-5 w-5 ${currentRecording.isFavourite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
          {/* Title & Description */}
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              {currentRecording.title}
            </h2>
            {currentRecording.description && (
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {currentRecording.description}
              </p>
            )}
            {currentRecording.tags.length > 0 && (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {currentRecording.tags.map((t) => `#${t}`).join('  ·  ')}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Waveform Scrubber & Time */}
          <div>
            <WaveformScrubber
              peaks={waveformPeaks}
              currentTime={currentTime}
              duration={duration}
              bookmarks={bookmarks}
              abRepeat={abRepeat}
              onSeek={seek}
            />
            <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Primary Transport Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={playPrevious}
              disabled={queue.length <= 1 && currentTime <= 3}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              aria-label="Previous recording"
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => skipBy(-skipSecs)}
              className="min-h-[44px] px-3 flex items-center justify-center gap-1 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={`Back ${skipSecs} seconds`}
            >
              <RotateCcw className="h-5 w-5" />
              <span className="text-xs font-mono tabular-nums">-{skipSecs}s</span>
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              disabled={isLoading}
              className="h-14 w-14 flex items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 shadow-sm transition-colors disabled:opacity-50"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => skipBy(skipSecs)}
              className="min-h-[44px] px-3 flex items-center justify-center gap-1 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={`Forward ${skipSecs} seconds`}
            >
              <span className="text-xs font-mono tabular-nums">+{skipSecs}s</span>
              <RotateCw className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={playNext}
              disabled={queue.length <= 1}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              aria-label="Next recording"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {/* Speed, Repeat, Shuffle & Volume */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-y border-slate-200 dark:border-slate-800 py-4">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {PLAYBACK_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`min-h-[36px] px-2.5 rounded-lg text-xs font-mono tabular-nums font-medium transition-colors whitespace-nowrap shrink-0 ${
                    playbackSpeed === spd
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <button
                type="button"
                onClick={toggleRepeatCurrent}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  repeatCurrent
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Repeat className="h-3.5 w-3.5" />
                <span>Repeat</span>
              </button>

              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={toggleShuffleQueue}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    shuffleQueue
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  <span>Shuffle</span>
                </button>
              )}

              {volumeSupported && (
                <div className="flex items-center gap-2 ml-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    aria-label="Volume"
                    className="w-20 accent-indigo-600 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* A-B Repeat Controls */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  A-B Loop Revision
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {abRepeat.enabled && abRepeat.pointA !== null && abRepeat.pointB !== null
                    ? `Looping ${formatDuration(abRepeat.pointA)} to ${formatDuration(abRepeat.pointB)}`
                    : 'Loop a specific explanation segment while revising difficult concepts.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPointA()}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    abRepeat.pointA !== null
                      ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Set A {abRepeat.pointA !== null ? `(${formatDuration(abRepeat.pointA)})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setPointB()}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    abRepeat.pointB !== null
                      ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Set B {abRepeat.pointB !== null ? `(${formatDuration(abRepeat.pointB)})` : ''}
                </button>
                {(abRepeat.pointA !== null || abRepeat.pointB !== null) && (
                  <button
                    type="button"
                    onClick={clearABRepeat}
                    className="min-h-[38px] px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    Disable
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bookmarks Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Bookmarks ({bookmarks.length})
              </h3>
              {queue.length > 1 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Track {queueIndex + 1} of {queue.length}
                </span>
              )}
            </div>

            <form onSubmit={handleAddBookmark} className="flex gap-2 mb-3">
              <input
                type="text"
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                placeholder={`Bookmark moment at ${formatDuration(currentTime)}...`}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={addingBookmark}
                className="min-h-[40px] px-3.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Bookmark</span>
              </button>
            </form>

            {bookmarks.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                No bookmarks yet. Tap Add Bookmark while listening to mark key definitions or formulas.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <button
                      type="button"
                      onClick={() => seek(bm.timestamp)}
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
                    >
                      <BookmarkIcon className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-mono text-xs tabular-nums text-indigo-700 dark:text-indigo-300 shrink-0">
                        {formatDuration(bm.timestamp)}
                      </span>
                      <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
                        {bm.label}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBookmark(bm.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      aria-label={`Delete bookmark ${bm.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
