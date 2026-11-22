import React, { useState, useRef, useEffect } from 'react';
import {
  Archive,
  Copy,
  Download,
  Edit3,
  FolderInput,
  Heart,
  ListPlus,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { Recording } from '../../types/recording';
import type { Subject } from '../../types/subject';
import type { Topic } from '../../types/topic';
import { formatDuration, formatRelativeDate } from '../../utils/formatTime';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

interface RecordingRowProps {
  recording: Recording;
  subject?: Subject;
  topic?: Topic;
  queueContext?: Recording[];
  showBreadcrumb?: boolean;
  onEdit?: (rec: Recording) => void;
  onMove?: (rec: Recording) => void;
  onDuplicate?: (rec: Recording) => void;
  onExport?: (rec: Recording) => void;
  onToggleFavourite: (rec: Recording) => void;
  onToggleArchive?: (rec: Recording) => void;
  onAddToQueue?: (rec: Recording) => void;
  onDelete?: (rec: Recording) => void;
  onRestore?: (rec: Recording) => void;
  onPermanentDelete?: (rec: Recording) => void;
}

export const RecordingRow: React.FC<RecordingRowProps> = ({
  recording,
  subject,
  topic,
  queueContext,
  showBreadcrumb = true,
  onEdit,
  onMove,
  onDuplicate,
  onExport,
  onToggleFavourite,
  onToggleArchive,
  onAddToQueue,
  onDelete,
  onRestore,
  onPermanentDelete,
}) => {
  const { currentRecording, isPlaying, playRecording, togglePlayPause } = useAudioPlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrent = currentRecording?.id === recording.id;
  const isCurrentPlaying = isCurrent && isPlaying;
  const isTrashed = recording.deletedAt !== null;

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handlePlayClick = () => {
    if (isTrashed) return;
    if (isCurrent) {
      togglePlayPause();
    } else {
      playRecording(recording, queueContext);
    }
  };

  const progressRatio =
    recording.duration > 0 && recording.lastPosition > 0.5
      ? Math.min(1, recording.lastPosition / recording.duration)
      : 0;

  return (
    <div
      className={`group relative flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 transition-colors border-b border-slate-200/80 dark:border-slate-800/80 last:border-b-0 ${
        isCurrent
          ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
      }`}
    >
      {!isTrashed ? (
        <button
          type="button"
          onClick={handlePlayClick}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
            isCurrent
              ? 'bg-indigo-600 text-white dark:bg-indigo-500'
              : 'bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-500'
          }`}
          aria-label={isCurrentPlaying ? `Pause ${recording.title}` : `Play ${recording.title}`}
        >
          {isCurrentPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <Trash2 className="h-4 w-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePlayClick}
            disabled={isTrashed}
            className={`text-left text-sm font-medium truncate focus:outline-none ${
              isCurrent
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {recording.title}
          </button>
          {recording.isArchived && (
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">· Archived</span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          {showBreadcrumb && subject && (
            <>
              <span className="truncate max-w-[200px]">
                {subject.name}
                {topic ? ` / ${topic.name}` : ''}
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="font-mono tabular-nums">{formatDuration(recording.duration)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatRelativeDate(recording.createdAt)}</span>
          {recording.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[220px]">
                {recording.tags.map((t) => `#${t}`).join(' ')}
              </span>
            </>
          )}
        </div>

        {progressRatio > 0 && !isTrashed && (
          <div className="mt-2 flex items-center gap-2 max-w-xs">
            <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full"
                style={{ width: `${Math.round(progressRatio * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {formatDuration(recording.lastPosition)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!isTrashed ? (
          <>
            <button
              type="button"
              onClick={() => onToggleFavourite(recording)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${
                recording.isFavourite
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              aria-label={recording.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Heart className={`h-4 w-4 ${recording.isFavourite ? 'fill-current' : ''}`} />
            </button>

            {onAddToQueue && (
              <button
                type="button"
                onClick={() => onAddToQueue(recording)}
                className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                aria-label="Add to revision queue"
                title="Add to revision queue"
              >
                <ListPlus className="h-4 w-4" />
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                aria-label={`More actions for ${recording.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 z-30 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] py-1.5 shadow-lg">
                  {onAddToQueue && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onAddToQueue(recording);
                      }}
                      className="sm:hidden w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <ListPlus className="h-4 w-4 text-slate-400" />
                      <span>Add to queue</span>
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(recording);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="h-4 w-4 text-slate-400" />
                      <span>Edit details</span>
                    </button>
                  )}
                  {onMove && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onMove(recording);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <FolderInput className="h-4 w-4 text-slate-400" />
                      <span>Move to topic</span>
                    </button>
                  )}
                  {onDuplicate && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDuplicate(recording);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Copy className="h-4 w-4 text-slate-400" />
                      <span>Duplicate</span>
                    </button>
                  )}
                  {onExport && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onExport(recording);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4 text-slate-400" />
                      <span>Export audio</span>
                    </button>
                  )}
                  {onToggleArchive && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleArchive(recording);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Archive className="h-4 w-4 text-slate-400" />
                      <span>{recording.isArchived ? 'Unarchive' : 'Archive'}</span>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(recording);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Move to Trash</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            {onRestore && (
              <button
                type="button"
                onClick={() => onRestore(recording)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore</span>
              </button>
            )}
            {onPermanentDelete && (
              <button
                type="button"
                onClick={() => onPermanentDelete(recording)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete forever</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
