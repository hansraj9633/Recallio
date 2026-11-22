import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { db } from '../database/db';
import { recordListeningSeconds, updateRecording } from '../services/libraryService';
import type { Recording } from '../types/recording';
import { useUserSettings } from './useSubjects';

export interface ABRepeatState {
  pointA: number | null;
  pointB: number | null;
  enabled: boolean;
}

interface AudioPlayerContextValue {
  currentRecording: Recording | null;
  queue: Recording[];
  queueIndex: number;
  waveformPeaks: number[];
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  repeatCurrent: boolean;
  shuffleQueue: boolean;
  abRepeat: ABRepeatState;
  isExpanded: boolean;
  activeRevisionQueueId: string | null;
  playRecording: (
    recording: Recording,
    queueList?: Recording[],
    options?: { revisionQueueId?: string; startAt?: number },
  ) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleRepeatCurrent: () => void;
  toggleShuffleQueue: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  setPointA: (time?: number) => void;
  setPointB: (time?: number) => void;
  clearABRepeat: () => void;
  setExpanded: (open: boolean) => void;
  closePlayer: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export const AudioPlayerProvider: React.FC<{
  children: React.ReactNode;
  onQueueTrackCompleted?: (queueId: string, recordingId: string) => void;
}> = ({ children, onQueueTrackCompleted }) => {
  const settings = useUserSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [currentRecording, setCurrentRecording] = useState<Recording | null>(null);
  const [queue, setQueue] = useState<Recording[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatCurrent, setRepeatCurrent] = useState(false);
  const [shuffleQueue, setShuffleQueue] = useState(false);
  const [isExpanded, setExpanded] = useState(false);
  const [activeRevisionQueueId, setActiveRevisionQueueId] = useState<string | null>(null);
  const [abRepeat, setAbRepeat] = useState<ABRepeatState>({
    pointA: null,
    pointB: null,
    enabled: false,
  });

  // Refs for callbacks inside event listeners
  const currentRecRef = useRef<Recording | null>(null);
  const abRepeatRef = useRef<ABRepeatState>(abRepeat);
  const repeatCurrentRef = useRef(repeatCurrent);
  const settingsRef = useRef(settings);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const shuffleRef = useRef(shuffleQueue);
  const activeRevQueueRef = useRef(activeRevisionQueueId);
  const listenedAccumulatorRef = useRef(0);
  const lastTimeTickRef = useRef(0);

  currentRecRef.current = currentRecording;
  abRepeatRef.current = abRepeat;
  repeatCurrentRef.current = repeatCurrent;
  settingsRef.current = settings;
  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  shuffleRef.current = shuffleQueue;
  activeRevQueueRef.current = activeRevisionQueueId;

  const revokeCurrentUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const persistProgress = useCallback(async (pos?: number) => {
    const rec = currentRecRef.current;
    const audio = audioRef.current;
    if (!rec || !audio || !settingsRef.current.autoSaveProgress) return;
    const position = typeof pos === 'number' ? pos : audio.currentTime;
    if (Number.isFinite(position)) {
      await updateRecording(rec.id, { lastPosition: position }).catch(() => {});
    }
    if (listenedAccumulatorRef.current >= 2) {
      const secs = listenedAccumulatorRef.current;
      listenedAccumulatorRef.current = 0;
      await recordListeningSeconds(secs).catch(() => {});
    }
  }, []);

  // Initialize single persistent HTMLAudioElement
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);

      // Accumulate real listened time
      if (!audio.paused) {
        const delta = t - lastTimeTickRef.current;
        if (delta > 0 && delta < 2) {
          listenedAccumulatorRef.current += delta;
        }
        lastTimeTickRef.current = t;
      }

      // Enforce A-B Repeat
      const ab = abRepeatRef.current;
      if (ab.enabled && ab.pointA !== null && ab.pointB !== null && t >= ab.pointB) {
        audio.currentTime = ab.pointA;
        lastTimeTickRef.current = ab.pointA;
      }
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      lastTimeTickRef.current = audio.currentTime;
    };

    const handlePause = () => {
      setIsPlaying(false);
      persistProgress();
    };

    const handleError = () => {
      setIsPlaying(false);
      setIsLoading(false);
      setError('Unable to play this audio file. The recording may be corrupted or unsupported.');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    const periodicSave = window.setInterval(() => {
      if (!audio.paused) {
        persistProgress();
      }
    }, 3000);

    const handlePageHide = () => {
      persistProgress();
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(periodicSave);
      window.removeEventListener('pagehide', handlePageHide);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
      revokeCurrentUrl();
    };
  }, [persistProgress, revokeCurrentUrl]);

  const loadAndPlay = useCallback(
    async (
      recording: Recording,
      queueList?: Recording[],
      options?: { revisionQueueId?: string; startAt?: number },
    ) => {
      const audio = audioRef.current;
      if (!audio) return;

      // Save previous track progress before switching
      if (currentRecRef.current && currentRecRef.current.id !== recording.id) {
        await persistProgress();
      }

      setIsLoading(true);
      setError(null);

      try {
        const blobRecord = await db.audioBlobs.get(recording.id);
        if (!blobRecord || !blobRecord.blob || blobRecord.blob.size === 0) {
          setIsLoading(false);
          setIsPlaying(false);
          setCurrentRecording(recording);
          setError('Audio data for this recording is missing from local storage.');
          return;
        }

        const effectiveQueue = queueList && queueList.length > 0 ? queueList : [recording];
        const idx = effectiveQueue.findIndex((r) => r.id === recording.id);

        setQueue(effectiveQueue);
        setQueueIndex(idx >= 0 ? idx : 0);
        setActiveRevisionQueueId(options?.revisionQueueId ?? null);
        setCurrentRecording(recording);
        setWaveformPeaks(blobRecord.waveformPeaks ?? []);
        setDuration(recording.duration || 0);
        setAbRepeat({ pointA: null, pointB: null, enabled: false });

        const speed = recording.playbackSpeed || settingsRef.current.defaultPlaybackSpeed || 1;
        setPlaybackSpeedState(speed);

        revokeCurrentUrl();
        const url = URL.createObjectURL(blobRecord.blob);
        objectUrlRef.current = url;

        audio.src = url;
        audio.playbackRate = speed;

        const resumePos =
          typeof options?.startAt === 'number'
            ? options.startAt
            : recording.lastPosition > 0 && recording.lastPosition < Math.max(0, recording.duration - 1.5)
              ? recording.lastPosition
              : 0;

        await new Promise<void>((resolve) => {
          const onReady = () => {
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('loadeddata', onReady);
            resolve();
          };
          audio.addEventListener('canplay', onReady);
          audio.addEventListener('loadeddata', onReady);
          audio.load();
        });

        if (resumePos > 0 && Number.isFinite(resumePos)) {
          audio.currentTime = resumePos;
          setCurrentTime(resumePos);
        } else {
          setCurrentTime(0);
        }

        await audio.play();
        setIsLoading(false);

        await updateRecording(recording.id, {
          lastPlayedAt: Date.now(),
          playCount: (recording.playCount || 0) + 1,
        });
      } catch (err) {
        console.error('Playback error:', err);
        setIsLoading(false);
        setIsPlaying(false);
        setError('Playback failed. Tap play to retry or check audio format support.');
      }
    },
    [persistProgress, revokeCurrentUrl],
  );

  // Handle track ended (Repeat, Auto-Play Next, Revision Queue completion)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = async () => {
      const rec = currentRecRef.current;
      if (rec) {
        await updateRecording(rec.id, { lastPosition: 0 }).catch(() => {});
        if (activeRevQueueRef.current && onQueueTrackCompleted) {
          onQueueTrackCompleted(activeRevQueueRef.current, rec.id);
        }
      }

      if (repeatCurrentRef.current) {
        audio.currentTime = 0;
        await audio.play().catch(() => {});
        return;
      }

      const list = queueRef.current;
      const idx = queueIndexRef.current;
      if (settingsRef.current.autoPlayNext && list.length > 1) {
        let nextIdx = idx + 1;
        if (shuffleRef.current) {
          const candidates = list.map((_, i) => i).filter((i) => i !== idx);
          nextIdx = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
        }
        if (nextIdx >= 0 && nextIdx < list.length) {
          await loadAndPlay(list[nextIdx], list, {
            revisionQueueId: activeRevQueueRef.current ?? undefined,
            startAt: 0,
          });
          return;
        }
      }
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [loadAndPlay, onQueueTrackCompleted]);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentRecRef.current) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setError('Tap play again to start audio playback.');
      }
    } else {
      audio.pause();
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || !currentRecRef.current) return;
      const maxDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      const clamped = Math.max(0, Math.min(maxDur || 0, seconds));
      audio.currentTime = clamped;
      lastTimeTickRef.current = clamped;
      setCurrentTime(clamped);
      persistProgress(clamped);
    },
    [duration, persistProgress],
  );

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio || !currentRecRef.current) return;
      seek(audio.currentTime + deltaSeconds);
    },
    [seek],
  );

  const setPlaybackSpeed = useCallback(async (speed: number) => {
    const audio = audioRef.current;
    setPlaybackSpeedState(speed);
    if (audio) {
      audio.playbackRate = speed;
    }
    if (currentRecRef.current) {
      await updateRecording(currentRecRef.current.id, { playbackSpeed: speed }).catch(() => {});
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      if (clamped > 0 && audioRef.current.muted) {
        audioRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const nextMuted = !audioRef.current.muted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const toggleRepeatCurrent = useCallback(() => {
    setRepeatCurrent((prev) => !prev);
  }, []);

  const toggleShuffleQueue = useCallback(() => {
    setShuffleQueue((prev) => !prev);
  }, []);

  const playNext = useCallback(async () => {
    const list = queueRef.current;
    const idx = queueIndexRef.current;
    if (list.length === 0) return;
    let nextIdx = idx + 1;
    if (shuffleRef.current && list.length > 1) {
      const candidates = list.map((_, i) => i).filter((i) => i !== idx);
      nextIdx = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    } else if (nextIdx >= list.length) {
      nextIdx = 0;
    }
    await loadAndPlay(list[nextIdx], list, {
      revisionQueueId: activeRevQueueRef.current ?? undefined,
      startAt: 0,
    });
  }, [loadAndPlay]);

  const playPrevious = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      seek(0);
      return;
    }
    const list = queueRef.current;
    const idx = queueIndexRef.current;
    if (list.length === 0) return;
    const prevIdx = idx - 1 < 0 ? list.length - 1 : idx - 1;
    await loadAndPlay(list[prevIdx], list, {
      revisionQueueId: activeRevQueueRef.current ?? undefined,
      startAt: 0,
    });
  }, [loadAndPlay, seek]);

  const setPointA = useCallback((time?: number) => {
    const t = typeof time === 'number' ? time : (audioRef.current?.currentTime ?? 0);
    setAbRepeat((prev) => {
      const nextB = prev.pointB !== null && prev.pointB > t + 0.3 ? prev.pointB : null;
      return {
        pointA: t,
        pointB: nextB,
        enabled: nextB !== null,
      };
    });
  }, []);

  const setPointB = useCallback((time?: number) => {
    const t = typeof time === 'number' ? time : (audioRef.current?.currentTime ?? 0);
    setAbRepeat((prev) => {
      if (prev.pointA === null) {
        return { pointA: Math.max(0, t - 5), pointB: t, enabled: true };
      }
      if (t <= prev.pointA + 0.3) {
        return { pointA: t, pointB: prev.pointA + 0.5, enabled: true };
      }
      return { pointA: prev.pointA, pointB: t, enabled: true };
    });
  }, []);

  const clearABRepeat = useCallback(() => {
    setAbRepeat({ pointA: null, pointB: null, enabled: false });
  }, []);

  const closePlayer = useCallback(() => {
    persistProgress();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    revokeCurrentUrl();
    setCurrentRecording(null);
    setIsPlaying(false);
    setExpanded(false);
    setError(null);
    setAbRepeat({ pointA: null, pointB: null, enabled: false });
  }, [persistProgress, revokeCurrentUrl]);

  // Keep currentRecording metadata synced when favourites/title/etc. update in IndexedDB
  useEffect(() => {
    if (!currentRecording?.id) return;
    let active = true;
    const interval = window.setInterval(async () => {
      const fresh = await db.recordings.get(currentRecording.id);
      if (active && fresh) {
        setCurrentRecording((prev) =>
          prev &&
          (prev.title !== fresh.title ||
            prev.isFavourite !== fresh.isFavourite ||
            prev.description !== fresh.description ||
            prev.topicId !== fresh.topicId)
            ? fresh
            : prev,
        );
      }
    }, 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentRecording?.id]);

  return (
    <AudioPlayerContext.Provider
      value={{
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
        activeRevisionQueueId,
        playRecording: loadAndPlay,
        togglePlayPause,
        pause,
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
        closePlayer,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return ctx;
}
