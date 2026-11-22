import { useCallback, useEffect, useRef, useState } from 'react';
import { extractWaveformPeaks, getSupportedAudioMimeType, measureAudioDuration } from '../utils/audio';
import type { RecordingQuality } from '../types/settings';

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

export interface RecorderResult {
  blob: Blob;
  mimeType: string;
  duration: number;
  waveformPeaks: number[];
}

export function useRecorder(quality: RecordingQuality = 'high') {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RecorderResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const startTimestampRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);
  const timerIntervalRef = useRef<number | null>(null);
  const livePeaksRef = useRef<number[]>([]);
  const statusRef = useRef<RecorderStatus>('idle');

  const updateStatus = (next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const cleanupStreams = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    setInputLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, [cleanupStreams]);

  const startMeterLoop = useCallback((analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (statusRef.current === 'recording') {
        analyser.getByteTimeDomainData(dataArray);
        let maxDev = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const dev = Math.abs(dataArray[i] - 128) / 128;
          if (dev > maxDev) maxDev = dev;
        }
        const normalized = Math.min(1, maxDev * 1.8);
        setInputLevel(normalized);
        livePeaksRef.current.push(Math.max(0.12, normalized));
      } else {
        setInputLevel(0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
    }
    startTimestampRef.current = performance.now();
    timerIntervalRef.current = window.setInterval(() => {
      if (statusRef.current === 'recording') {
        const currentMs = accumulatedMsRef.current + (performance.now() - startTimestampRef.current);
        setElapsed(currentMs / 1000);
      }
    }, 100);
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setResult(null);
    chunksRef.current = [];
    livePeaksRef.current = [];
    accumulatedMsRef.current = 0;
    setElapsed(0);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      updateStatus('error');
      setErrorMessage(
        'Microphone recording is not supported in this browser or context (HTTPS is required). You can still import an audio file below.',
      );
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      updateStatus('error');
      setErrorMessage(
        'The MediaRecorder API is not supported in this browser. Try a modern browser or import an audio file.',
      );
      return;
    }

    updateStatus('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const bitRate = quality === 'high' ? 128000 : 64000;
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: bitRate })
          : new MediaRecorder(stream, { audioBitsPerSecond: bitRate });
      } catch {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      // Setup Web Audio Analyser for real-time waveform & level metering
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        startMeterLoop(analyser);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupStreams();
        updateStatus('error');
        setErrorMessage('Recording was interrupted due to an audio hardware or browser error.');
      };

      // Monitor unexpected track end (e.g. mic unplugged)
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (statusRef.current === 'recording' || statusRef.current === 'paused') {
            stopRecording();
          }
        };
      });

      recorder.start(250);
      updateStatus('recording');
      startTimer();
    } catch (err) {
      cleanupStreams();
      updateStatus('error');
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage(
            'Microphone permission was denied. Please allow microphone access in your browser site settings and try again.',
          );
          return;
        }
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setErrorMessage(
            'No microphone was detected on this device. Connect a microphone or import an existing audio file.',
          );
          return;
        }
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setErrorMessage(
            'Your microphone is currently in use by another application. Close other audio apps and try again.',
          );
          return;
        }
      }
      setErrorMessage('Could not start audio recording. Please check microphone permissions.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupStreams, quality, startMeterLoop, startTimer]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || statusRef.current !== 'recording') return;
    try {
      if (recorder.state === 'recording') {
        recorder.pause();
        accumulatedMsRef.current += performance.now() - startTimestampRef.current;
        setElapsed(accumulatedMsRef.current / 1000);
        updateStatus('paused');
      }
    } catch {
      setErrorMessage('Pausing is not supported on this browser.');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || statusRef.current !== 'paused') return;
    try {
      if (recorder.state === 'paused') {
        recorder.resume();
        startTimestampRef.current = performance.now();
        updateStatus('recording');
      }
    } catch {
      setErrorMessage('Could not resume recording.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || (statusRef.current !== 'recording' && statusRef.current !== 'paused')) return;

    if (statusRef.current === 'recording') {
      accumulatedMsRef.current += performance.now() - startTimestampRef.current;
    }
    const finalElapsed = Math.max(0.5, accumulatedMsRef.current / 1000);

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          resolve();
        }
      } catch {
        resolve();
      }
    });

    const recordedMime = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: recordedMime });
    cleanupStreams();

    if (blob.size === 0) {
      updateStatus('error');
      setErrorMessage('No audio data was captured. Please check your microphone and try again.');
      return;
    }

    const measuredDuration = await measureAudioDuration(blob);
    const duration = measuredDuration > 0.3 ? measuredDuration : finalElapsed;
    const peaks = await extractWaveformPeaks(blob, 64);

    setElapsed(duration);
    setResult({
      blob,
      mimeType: recordedMime,
      duration,
      waveformPeaks: peaks,
    });
    updateStatus('stopped');
  }, [cleanupStreams]);

  const discardRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
    } catch {
      // Ignore
    }
    cleanupStreams();
    chunksRef.current = [];
    livePeaksRef.current = [];
    accumulatedMsRef.current = 0;
    setElapsed(0);
    setResult(null);
    setErrorMessage(null);
    updateStatus('idle');
  }, [cleanupStreams]);

  const loadImportedFile = useCallback(async (file: File) => {
    setErrorMessage(null);
    if (!file.type.startsWith('audio/') && !/\.(webm|mp3|m4a|wav|ogg|aac)$/i.test(file.name)) {
      updateStatus('error');
      setErrorMessage('Selected file does not appear to be a supported audio format.');
      return;
    }
    const duration = await measureAudioDuration(file);
    if (duration <= 0) {
      updateStatus('error');
      setErrorMessage('Could not decode this audio file. The file may be unsupported or corrupted.');
      return;
    }
    const peaks = await extractWaveformPeaks(file, 64);
    setElapsed(duration);
    setResult({
      blob: file,
      mimeType: file.type || 'audio/mpeg',
      duration,
      waveformPeaks: peaks,
    });
    updateStatus('stopped');
  }, []);

  return {
    status,
    elapsed,
    inputLevel,
    errorMessage,
    result,
    analyserNode: analyserRef.current,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    loadImportedFile,
  };
}
