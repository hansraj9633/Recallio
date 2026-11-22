import React, { useRef, useState } from 'react';
import type { Bookmark } from '../../types/recording';
import type { ABRepeatState } from '../../hooks/useAudioPlayer';

interface WaveformScrubberProps {
  peaks: number[];
  currentTime: number;
  duration: number;
  bookmarks?: Bookmark[];
  abRepeat?: ABRepeatState;
  onSeek: (time: number) => void;
  compact?: boolean;
}

export const WaveformScrubber: React.FC<WaveformScrubberProps> = ({
  peaks,
  currentTime,
  duration,
  bookmarks = [],
  abRepeat,
  onSeek,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const safePeaks =
    peaks.length > 0
      ? peaks
      : Array.from({ length: 56 }, (_, i) => 0.3 + 0.45 * Math.abs(Math.sin(i * 0.45)));

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  const computeTimeFromPointer = (clientX: number): number => {
    const el = containerRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onSeek(computeTimeFromPointer(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = computeTimeFromPointer(e.clientX);
    setHoverTime(t);
    if (dragging) {
      onSeek(t);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) {
      setDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const pointAPercent =
    abRepeat?.pointA !== null && abRepeat?.pointA !== undefined && duration > 0
      ? Math.max(0, Math.min(100, (abRepeat.pointA / duration) * 100))
      : null;

  const pointBPercent =
    abRepeat?.pointB !== null && abRepeat?.pointB !== undefined && duration > 0
      ? Math.max(0, Math.min(100, (abRepeat.pointB / duration) * 100))
      : null;

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label="Audio timeline"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + 5));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onSeek(Math.max(0, currentTime - 5));
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        setHoverTime(null);
        setDragging(false);
      }}
      className={`relative w-full select-none touch-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl ${
        compact ? 'h-10 py-1' : 'h-20 py-2'
      }`}
    >
      {/* A-B Repeat Highlight Region */}
      {pointAPercent !== null && pointBPercent !== null && pointBPercent > pointAPercent && (
        <div
          className="absolute top-1 bottom-1 rounded bg-amber-500/15 dark:bg-amber-400/15 border-x border-amber-500/60 pointer-events-none"
          style={{
            left: `${pointAPercent}%`,
            width: `${pointBPercent - pointAPercent}%`,
          }}
        />
      )}

      {/* Point A marker only */}
      {pointAPercent !== null && pointBPercent === null && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-500 pointer-events-none"
          style={{ left: `${pointAPercent}%` }}
        />
      )}

      {/* Waveform Bars */}
      <div className="relative flex h-full w-full items-center gap-[2px] sm:gap-[3px]">
        {safePeaks.map((peak, idx) => {
          const barPos = (idx + 0.5) / safePeaks.length;
          const isPassed = barPos <= progress;
          const isHovered =
            hoverTime !== null && duration > 0 && barPos <= hoverTime / duration;
          return (
            <div
              key={idx}
              className={`flex-1 rounded-full transition-colors duration-75 ${
                isPassed
                  ? 'bg-indigo-600 dark:bg-indigo-400'
                  : isHovered
                    ? 'bg-indigo-300 dark:bg-indigo-700'
                    : 'bg-slate-200 dark:bg-slate-700/80'
              }`}
              style={{
                height: `${Math.max(16, Math.round(peak * 100))}%`,
              }}
            />
          );
        })}
      </div>

      {/* Bookmark Markers */}
      {!compact &&
        duration > 0 &&
        bookmarks.map((bm) => {
          const leftPct = Math.max(0, Math.min(100, (bm.timestamp / duration) * 100));
          return (
            <button
              key={bm.id}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(bm.timestamp);
              }}
              title={bm.label}
              aria-label={`Jump to bookmark ${bm.label}`}
              className="absolute -top-0.5 -translate-x-1/2 h-3 w-3 rounded-full bg-indigo-600 dark:bg-indigo-400 ring-2 ring-white dark:ring-[#111827] hover:scale-125 transition-transform"
              style={{ left: `${leftPct}%` }}
            />
          );
        })}
    </div>
  );
};
