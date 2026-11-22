import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  Mic,
  Pause,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRecorder } from '../hooks/useRecorder';
import { useSubjects, useTopics, useUserSettings } from '../hooks/useSubjects';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { createSubject, createTopic, saveNewRecording } from '../services/libraryService';
import { triggerFileDownload } from '../services/backupService';
import { getExtensionFromMimeType } from '../utils/audio';
import { formatBytes, formatDuration, formatPreciseTimer } from '../utils/formatTime';
import { LiveWaveformCanvas } from '../components/recording/LiveWaveformCanvas';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

interface RecordingStudioProps {
  initialSubjectId?: string;
  initialTopicId?: string;
  onSessionActiveChange: (active: boolean) => void;
  onSaved: (subjectId: string, topicId: string) => void;
  onCancelExit: () => void;
}

export const RecordingStudio: React.FC<RecordingStudioProps> = ({
  initialSubjectId,
  initialTopicId,
  onSessionActiveChange,
  onSaved,
  onCancelExit,
}) => {
  const settings = useUserSettings();
  const subjects = useSubjects();
  const topics = useTopics();
  const { pause: pauseGlobalPlayer } = useAudioPlayer();
  const { showToast } = useToast();

  const {
    status,
    elapsed,
    inputLevel,
    errorMessage,
    result,
    analyserNode,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    loadImportedFile,
  } = useRecorder(settings.recordingQuality);

  const activeSubjects = useMemo(() => subjects.filter((s) => !s.isArchived), [subjects]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId ?? '');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopicId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // Quick inline subject/topic creation inside save workflow
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');

  // Preview audio playback on Save screen
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const previewUrlRef = useRef<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync unsaved state with parent & browser beforeunload
  const isSessionActive =
    status === 'recording' || status === 'paused' || status === 'stopped' || status === 'requesting';

  useEffect(() => {
    onSessionActiveChange(isSessionActive);
    return () => onSessionActiveChange(false);
  }, [isSessionActive, onSessionActiveChange]);

  useEffect(() => {
    if (!isSessionActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSessionActive]);

  // Pre-select subject and topic defaults
  useEffect(() => {
    if (initialSubjectId && activeSubjects.some((s) => s.id === initialSubjectId)) {
      setSelectedSubjectId(initialSubjectId);
    } else if (!selectedSubjectId && activeSubjects.length > 0) {
      setSelectedSubjectId(activeSubjects[0].id);
    }
  }, [initialSubjectId, activeSubjects, selectedSubjectId]);

  const availableTopics = useMemo(
    () => topics.filter((t) => t.subjectId === selectedSubjectId && !t.isArchived),
    [topics, selectedSubjectId],
  );

  useEffect(() => {
    if (initialTopicId && availableTopics.some((t) => t.id === initialTopicId)) {
      setSelectedTopicId(initialTopicId);
    } else if (
      availableTopics.length > 0 &&
      !availableTopics.some((t) => t.id === selectedTopicId)
    ) {
      setSelectedTopicId(availableTopics[0].id);
    } else if (availableTopics.length === 0) {
      setSelectedTopicId('');
    }
  }, [initialTopicId, availableTopics, selectedTopicId]);

  // Set default title once when entering Save screen
  const defaultTitleSetForRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (status === 'stopped' && result && defaultTitleSetForRef.current !== result.blob) {
      defaultTitleSetForRef.current = result.blob;
      setTitle((prev) => {
        if (prev.trim()) return prev;
        const stamp = new Date().toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        return `Voice Note — ${stamp}`;
      });
    }
  }, [status, result]);

  // Setup preview audio URL when recording stops
  useEffect(() => {
    if (status === 'stopped' && result) {
      const url = URL.createObjectURL(result.blob);
      previewUrlRef.current = url;
      const audio = new Audio(url);
      previewAudioRef.current = audio;

      const onTime = () => setPreviewTime(audio.currentTime);
      const onEnd = () => {
        setPreviewPlaying(false);
        setPreviewTime(0);
      };
      audio.addEventListener('timeupdate', onTime);
      audio.addEventListener('ended', onEnd);

      return () => {
        audio.pause();
        audio.removeEventListener('timeupdate', onTime);
        audio.removeEventListener('ended', onEnd);
        URL.revokeObjectURL(url);
        previewUrlRef.current = null;
        previewAudioRef.current = null;
        setPreviewPlaying(false);
        setPreviewTime(0);
      };
    }
  }, [status, result]);

  const handleStart = async () => {
    pauseGlobalPlayer();
    setSaveError(null);
    setTitle('');
    setDescription('');
    setTagsInput('');
    await startRecording();
  };

  const togglePreviewPlay = async () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setPreviewPlaying(true);
    } else {
      audio.pause();
      setPreviewPlaying(false);
    }
  };

  const handleQuickCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    const subj = await createSubject({
      name: newSubjectName.trim(),
      color: 'indigo',
      icon: 'book',
    });
    setSelectedSubjectId(subj.id);
    setNewSubjectName('');
    setCreatingSubject(false);
    setCreatingTopic(true);
  };

  const handleQuickCreateTopic = async () => {
    if (!newTopicName.trim() || !selectedSubjectId) return;
    const topic = await createTopic({
      subjectId: selectedSubjectId,
      name: newTopicName.trim(),
    });
    setSelectedTopicId(topic.id);
    setNewTopicName('');
    setCreatingTopic(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || saving) return;
    if (!selectedSubjectId || !selectedTopicId) {
      setSaveError('Please select or create a subject and topic for this recording.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await saveNewRecording({
        subjectId: selectedSubjectId,
        topicId: selectedTopicId,
        title: title.trim() || 'Untitled Voice Note',
        description: description.trim(),
        tags,
        duration: result.duration,
        mimeType: result.mimeType,
        blob: result.blob,
        waveformPeaks: result.waveformPeaks,
        defaultSpeed: settings.defaultPlaybackSpeed,
      });

      discardRecording();
      showToast('Recording saved offline to library', 'success');
      onSaved(selectedSubjectId, selectedTopicId);
    } catch (err) {
      console.error('Save error:', err);
      const isQuota =
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      setSaveError(
        isQuota
          ? 'Browser storage quota is full. Download this recording below to keep it safe, then free up storage in Settings.'
          : 'Could not save recording to IndexedDB. Download it below as a backup.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadUnsaved = () => {
    if (!result) return;
    const ext = getExtensionFromMimeType(result.mimeType);
    const safeName = (title || 'recallio-recording').replace(/[^a-z0-9\-_\s]/gi, '').trim() || 'recording';
    triggerFileDownload(result.blob, `${safeName}.${ext}`);
  };

  const confirmDiscard = () => {
    setConfirmDiscardOpen(false);
    discardRecording();
    onCancelExit();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Recording Studio
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Speak through concepts in your own words. Saved locally on this device.
          </p>
        </div>
      </div>

      {/* Active / Idle / Error Studio Card */}
      {status !== 'stopped' ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <Mic
                className={`h-4 w-4 ${
                  status === 'recording'
                    ? 'text-rose-600 dark:text-rose-400'
                    : status === 'paused'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-500 dark:text-slate-400'
                }`}
              />
              <span
                className={
                  status === 'recording'
                    ? 'text-rose-700 dark:text-rose-400'
                    : status === 'paused'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-slate-600 dark:text-slate-300'
                }
              >
                {status === 'idle' && 'Microphone ready'}
                {status === 'requesting' && 'Requesting microphone access...'}
                {status === 'recording' && 'Recording active'}
                {status === 'paused' && 'Recording paused'}
                {status === 'error' && 'Microphone unavailable'}
              </span>
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400">
              {settings.recordingQuality === 'high' ? 'High quality (128 kbps)' : 'Standard (64 kbps)'}
            </span>
          </div>

          {/* Timer */}
          <div className="my-8 text-center">
            <div className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
              {formatPreciseTimer(elapsed)}
            </div>
          </div>

          {/* Live Waveform Canvas */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] px-3 py-2">
            <LiveWaveformCanvas analyser={analyserNode} status={status} />
          </div>

          {/* Microphone Input Level Meter */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Input level</span>
            <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-400 transition-[width] duration-75 rounded-full"
                style={{ width: `${Math.round(inputLevel * 100)}%` }}
              />
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="flex-1">
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {(status === 'idle' || status === 'error') && (
              <>
                <button
                  type="button"
                  onClick={handleStart}
                  className="min-h-[52px] px-7 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm flex items-center gap-2.5 shadow-sm transition-colors"
                >
                  <Mic className="h-5 w-5" />
                  <span>Start Recording</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadImportedFile(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm flex items-center gap-2 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>Import Audio File</span>
                </button>
              </>
            )}

            {status === 'requesting' && (
              <button
                type="button"
                disabled
                className="min-h-[52px] px-7 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 text-sm font-medium"
              >
                Waiting for microphone permission...
              </button>
            )}

            {(status === 'recording' || status === 'paused') && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDiscardOpen(true)}
                  className="min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Discard</span>
                </button>

                {status === 'recording' ? (
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="min-h-[48px] px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Pause className="h-4 w-4" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeRecording}
                    className="min-h-[48px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    <span>Resume</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={stopRecording}
                  className="min-h-[48px] px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>Stop & Review</span>
                </button>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Microphone audio is processed in-browser and never uploaded to external servers.
          </p>
        </div>
      ) : (
        /* Save Recording Workflow */
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Save Recording
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                {formatDuration(result?.duration ?? 0)} · {formatBytes(result?.blob.size ?? 0)}
              </p>
            </div>

            {result && (
              <button
                type="button"
                onClick={togglePreviewPlay}
                className="min-h-[40px] px-4 rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-medium flex items-center gap-2"
              >
                {previewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>
                  {previewPlaying ? 'Pause preview' : 'Preview audio'} ({formatDuration(previewTime)})
                </span>
              </button>
            )}
          </div>

          {saveError && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 space-y-3">
              <p className="text-sm text-rose-800 dark:text-rose-200">{saveError}</p>
              <button
                type="button"
                onClick={handleDownloadUnsaved}
                className="min-h-[38px] px-3.5 rounded-lg bg-rose-600 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download recording to device</span>
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Recording Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Water-Cement Ratio & Strength"
              required
              autoFocus
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Subject Select or Quick Create */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Subject
                </label>
                <button
                  type="button"
                  onClick={() => setCreatingSubject((v) => !v)}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" />
                  <span>{creatingSubject ? 'Cancel' : 'New Subject'}</span>
                </button>
              </div>
              {creatingSubject ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Subject name..."
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateSubject}
                    className="px-3 rounded-xl bg-indigo-600 text-white text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {activeSubjects.length === 0 && <option value="">No subjects yet</option>}
                  {activeSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Topic Select or Quick Create */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Topic
                </label>
                {selectedSubjectId && (
                  <button
                    type="button"
                    onClick={() => setCreatingTopic((v) => !v)}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{creatingTopic ? 'Cancel' : 'New Topic'}</span>
                  </button>
                )}
              </div>
              {creatingTopic ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="Topic name..."
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateTopic}
                    className="px-3 rounded-xl bg-indigo-600 text-white text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {availableTopics.length === 0 && <option value="">Create a topic first</option>}
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Key points, definitions, or questions to remember..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Tags (optional, comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. exam, formula, chapter-4"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setConfirmDiscardOpen(true)}
              className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Discard Recording</span>
            </button>

            <button
              type="submit"
              disabled={saving || !selectedSubjectId || !selectedTopicId}
              className="min-h-[44px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Recording'}</span>
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard this recording?"
        description="This audio recording has not been saved yet. Discarding will permanently remove it."
        confirmLabel="Discard"
        destructive
        onConfirm={confirmDiscard}
        onCancel={() => setConfirmDiscardOpen(false)}
      />
    </div>
  );
};
