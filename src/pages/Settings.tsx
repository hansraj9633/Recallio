import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  Monitor,
  Moon,
  Shield,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { db } from '../database/db';
import { removeAllSampleData } from '../database/seed';
import { softDeleteRecording } from '../services/libraryService';
import {
  exportBackupArchive,
  exportSingleRecording,
  importBackupArchive,
} from '../services/backupService';
import { useUserSettings } from '../hooks/useSubjects';
import {
  PLAYBACK_SPEEDS,
  SKIP_INTERVALS,
  type RecordingQuality,
  type ThemePreference,
} from '../types/settings';
import type { Recording } from '../types/recording';
import { formatBytes, formatDuration, formatHumanDuration } from '../utils/formatTime';
import {
  getBrowserStorageEstimate,
  requestPersistentStorage,
  type BrowserStorageEstimate,
} from '../utils/storage';
import { PWAInstallButton } from '../components/common/PWAInstallButton';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

interface SettingsProps {
  recordings: Recording[];
}

export const Settings: React.FC<SettingsProps> = ({ recordings }) => {
  const settings = useUserSettings();
  const { showToast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [storageEst, setStorageEst] = useState<BrowserStorageEstimate>({
    usage: 0,
    quota: 0,
    supported: false,
    persisted: null,
  });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmRemoveSample, setConfirmRemoveSample] = useState(false);
  const [deletingRec, setDeletingRec] = useState<Recording | null>(null);

  const refreshStorage = async () => {
    const est = await getBrowserStorageEstimate();
    setStorageEst(est);
  };

  useEffect(() => {
    refreshStorage();
  }, [recordings.length]);

  const updateSettings = async (patch: Partial<typeof settings>) => {
    await db.settings.update('user_settings', patch);
    if (patch.theme) {
      localStorage.setItem('recallio_theme', patch.theme);
    }
  };

  const totalAudioSize = useMemo(
    () => recordings.reduce((sum, r) => sum + (r.audioSize || 0), 0),
    [recordings],
  );
  const totalDuration = useMemo(
    () => recordings.reduce((sum, r) => sum + (r.duration || 0), 0),
    [recordings],
  );
  const largestRecordings = useMemo(
    () => [...recordings].sort((a, b) => (b.audioSize || 0) - (a.audioSize || 0)).slice(0, 5),
    [recordings],
  );
  const hasSampleData = useMemo(() => recordings.some((r) => Boolean(r.isSample)), [recordings]);

  const handleRequestPersist = async () => {
    const res = await requestPersistentStorage();
    await refreshStorage();
    if (!res.supported) {
      showToast('Persistent Storage API is not supported in this browser.', 'info');
    } else if (res.granted) {
      showToast('Persistent storage granted by browser.', 'success');
    } else {
      showToast(
        'Browser did not grant automatic persistence. Export periodic ZIP backups to protect your notes.',
        'info',
      );
    }
  };

  const handleExportAll = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportBackupArchive();
      showToast('Full Recallio backup archive exported', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Backup export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || importing) return;
    setImporting(true);
    try {
      const summary = await importBackupArchive(file);
      await refreshStorage();
      showToast(
        `Imported ${summary.recordingsAdded} recordings, ${summary.subjectsAdded} subjects, ${summary.topicsAdded} topics` +
          (summary.skippedExisting > 0 ? ` (${summary.skippedExisting} already existed)` : ''),
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid backup file', 'error');
    } finally {
      setImporting(false);
    }
  };

  const quotaPct =
    storageEst.supported && storageEst.quota > 0
      ? Math.min(100, Math.round((storageEst.usage / storageEst.quota) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-6 sm:py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Preferences, offline storage management, and backup archives.
        </p>
      </div>

      {/* Appearance */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(
            [
              { id: 'light', label: 'Light', Icon: Sun },
              { id: 'dark', label: 'Dark', Icon: Moon },
              { id: 'system', label: 'System', Icon: Monitor },
            ] as { id: ThemePreference; label: string; Icon: React.FC<{ className?: string }> }[]
          ).map(({ id, label, Icon }) => {
            const active = settings.theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => updateSettings({ theme: id })}
                className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors ${
                  active
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Audio & Recording Preferences */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-200 dark:divide-slate-800">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Default Playback Speed
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Applied to newly recorded notes.
            </div>
          </div>
          <select
            value={settings.defaultPlaybackSpeed}
            onChange={(e) => updateSettings({ defaultPlaybackSpeed: Number(e.target.value) })}
            aria-label="Default playback speed"
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
          >
            {PLAYBACK_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Default Skip Interval
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Jump duration for forward and backward skip buttons.
            </div>
          </div>
          <select
            value={settings.defaultSkipInterval}
            onChange={(e) => updateSettings({ defaultSkipInterval: Number(e.target.value) })}
            aria-label="Default skip interval"
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
          >
            {SKIP_INTERVALS.map((s) => (
              <option key={s} value={s}>
                {s} seconds
              </option>
            ))}
          </select>
        </div>

        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Auto-play Next Recording
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Continue automatically to the next note in a topic or revision queue.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoPlayNext}
            onClick={() => updateSettings({ autoPlayNext: !settings.autoPlayNext })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.autoPlayNext ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                settings.autoPlayNext ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Auto-save Listening Progress
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Remember your timestamp position so you can resume where you left off.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoSaveProgress}
            onClick={() => updateSettings({ autoSaveProgress: !settings.autoSaveProgress })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.autoSaveProgress ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                settings.autoSaveProgress ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Default Recording Quality
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Target bitrate where supported by your browser audio encoder.
            </div>
          </div>
          <select
            value={settings.recordingQuality}
            onChange={(e) => updateSettings({ recordingQuality: e.target.value as RecordingQuality })}
            aria-label="Recording quality"
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          >
            <option value="high">High (128 kbps)</option>
            <option value="standard">Standard (64 kbps — saves space)</option>
          </select>
        </div>
      </section>

      {/* Storage Management & Backup */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Storage Management & Backup</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              All audio recordings are stored locally in your browser IndexedDB database.
            </p>
          </div>
        </div>

        {/* Storage Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Recordings</div>
            <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {recordings.length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Audio Duration</div>
            <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatHumanDuration(totalDuration)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Audio Storage Used</div>
            <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatBytes(totalAudioSize)}
            </div>
          </div>
        </div>

        {/* Browser Storage Quota & Persistent Storage */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/70 dark:bg-slate-900/40">
          {storageEst.supported && storageEst.quota > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                <span>Browser Storage Quota</span>
                <span className="font-mono tabular-nums">
                  {formatBytes(storageEst.usage)} / {formatBytes(storageEst.quota)} ({quotaPct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full"
                  style={{ width: `${Math.max(1, quotaPct)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {storageEst.persisted === true ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Persistent storage is active. Your browser will protect local data from automatic cleanup.
                </span>
              ) : (
                <span>
                  Browsers may clear site data under extreme disk pressure unless persistent storage is granted. Always keep periodic ZIP backups.
                </span>
              )}
            </div>

            {storageEst.persisted !== true && (
              <button
                type="button"
                onClick={handleRequestPersist}
                className="min-h-[38px] px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                Request Persistent Storage
              </button>
            )}
          </div>
        </div>

        {/* Backup Export / Import */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exporting || recordings.length === 0}
            className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{exporting ? 'Creating ZIP...' : 'Export Full Backup (.zip)'}</span>
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            <span>{importing ? 'Importing...' : 'Import Backup (.zip)'}</span>
          </button>
        </div>

        {/* Largest Recordings */}
        {largestRecordings.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Largest Recordings
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {largestRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {rec.title}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {formatBytes(rec.audioSize)} · {formatDuration(rec.duration)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => exportSingleRecording(rec.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      aria-label={`Export ${rec.title}`}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRec(rec)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      aria-label={`Delete ${rec.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Install & Sample Data */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Archive className="h-4 w-4 text-slate-400" />
            <span>Offline App Installation</span>
          </h2>
          <PWAInstallButton variant="settings" />
        </div>

        {hasSampleData && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-400" />
                <span>Sample Study Data</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Remove the initial Civil Engineering & Physiology demonstration subjects and recordings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmRemoveSample(true)}
              className="min-h-[40px] px-4 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium whitespace-nowrap shrink-0"
            >
              Remove Sample Data
            </button>
          </div>
        )}
      </section>

      {/* Privacy & About */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>Privacy & About Recallio</span>
        </div>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Recallio runs offline-first in your browser. Your microphone audio, subjects, topics, bookmarks, and revision queues are stored locally in IndexedDB and are never uploaded to external servers or analytics services. Note that browser IndexedDB storage is protected by your operating system user account and browser origin isolation, rather than custom password encryption—export encrypted backups externally if storing sensitive material on shared devices.
        </p>
        <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          Recallio · Version 1.0.0 · Your voice. Your notes. Your revision.
        </div>
      </section>

      <ConfirmDialog
        open={confirmRemoveSample}
        title="Remove sample demonstration data?"
        description="All sample subjects, topics, and sample recordings will be removed. Your own recordings will remain untouched."
        confirmLabel="Remove Sample Data"
        destructive
        onConfirm={async () => {
          await removeAllSampleData();
          setConfirmRemoveSample(false);
          showToast('Sample data removed', 'info');
        }}
        onCancel={() => setConfirmRemoveSample(false)}
      />

      <ConfirmDialog
        open={!!deletingRec}
        title="Move recording to Trash?"
        description={`"${deletingRec?.title ?? ''}" will be moved to Recently Deleted in your Library.`}
        confirmLabel="Move to Trash"
        destructive
        onConfirm={async () => {
          if (deletingRec) {
            await softDeleteRecording(deletingRec.id);
            showToast('Moved to Recently Deleted', 'info');
            setDeletingRec(null);
          }
        }}
        onCancel={() => setDeletingRec(null)}
      />
    </div>
  );
};
