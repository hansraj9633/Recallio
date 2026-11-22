import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Mic, Search, WifiOff } from 'lucide-react';
import { AudioPlayerProvider, useAudioPlayer } from './hooks/useAudioPlayer';
import {
  useAppReady,
  useRecordings,
  useRevisionActivity,
  useRevisionQueues,
  useSubjects,
  useTopics,
  useUserSettings,
} from './hooks/useSubjects';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { db } from './database/db';
import { updateRevisionQueue } from './services/libraryService';
import type { Recording } from './types/recording';
import { Sidebar, type NavTab } from './components/navigation/Sidebar';
import { MobileBottomNav } from './components/navigation/MobileBottomNav';
import { MiniPlayer } from './components/player/MiniPlayer';
import { ExpandedPlayer } from './components/player/ExpandedPlayer';
import { SearchModal } from './components/common/SearchModal';
import { AddToQueueModal } from './components/revision/AddToQueueModal';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { ToastProvider } from './components/common/Toast';
import { Home } from './pages/Home';
import { Library } from './pages/Library';

const SubjectDetails = lazy(() =>
  import('./pages/SubjectDetails').then((m) => ({ default: m.SubjectDetails })),
);
const TopicDetails = lazy(() =>
  import('./pages/TopicDetails').then((m) => ({ default: m.TopicDetails })),
);
const RecordingStudio = lazy(() =>
  import('./pages/RecordingStudio').then((m) => ({ default: m.RecordingStudio })),
);
const Revision = lazy(() => import('./pages/Revision').then((m) => ({ default: m.Revision })));
const Favourites = lazy(() =>
  import('./pages/Favourites').then((m) => ({ default: m.Favourites })),
);
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

const RecallioShell: React.FC = () => {
  const { ready, error: dbError } = useAppReady();
  const settings = useUserSettings();
  const subjects = useSubjects();
  const topics = useTopics();
  const recordings = useRecordings();
  const trashedRecordings = useRecordings({ onlyDeleted: true });
  const revisionQueues = useRevisionQueues();
  const activity = useRevisionActivity();
  const isOnline = useOnlineStatus();

  const {
    currentRecording,
    togglePlayPause,
    skipBy,
  } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [recordPreset, setRecordPreset] = useState<{ subjectId?: string; topicId?: string }>({});

  const [searchOpen, setSearchOpen] = useState(false);
  const [queueTargetRec, setQueueTargetRec] = useState<Recording | null>(null);
  const [recordingSessionActive, setRecordingSessionActive] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Sync light/dark/system theme on <html> and <meta name="theme-color">
  useEffect(() => {
    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark =
        settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', isDark ? '#0B0F17' : '#F8F9FA');
      }
      localStorage.setItem('recallio_theme', settings.theme);
    };

    applyTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  const guardedNavigate = useCallback(
    (action: () => void) => {
      if (recordingSessionActive) {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [recordingSessionActive],
  );

  const navigateToTab = useCallback(
    (tab: NavTab) => {
      guardedNavigate(() => {
        setActiveTab(tab);
        if (tab === 'library') {
          setSelectedSubjectId(null);
          setSelectedTopicId(null);
        }
        if (tab === 'record') {
          setRecordPreset({});
        }
      });
    },
    [guardedNavigate],
  );

  const openRecorderWithContext = useCallback(
    (subjectId?: string, topicId?: string) => {
      guardedNavigate(() => {
        setRecordPreset({ subjectId, topicId });
        setActiveTab('record');
      });
    },
    [guardedNavigate],
  );

  // Desktop keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(target?.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }

      if (isTyping) return;

      if (e.key === 'Escape') {
        setSearchOpen(false);
        return;
      }

      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (activeTab !== 'record') {
          e.preventDefault();
          openRecorderWithContext();
        }
        return;
      }

      if (!currentRecording || recordingSessionActive) return;

      if (e.code === 'Space' && tag !== 'button' && tag !== 'a') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft' && !e.altKey && !e.metaKey) {
        e.preventDefault();
        skipBy(-(settings.defaultSkipInterval || 10));
      } else if (e.key === 'ArrowRight' && !e.altKey && !e.metaKey) {
        e.preventDefault();
        skipBy(settings.defaultSkipInterval || 10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    currentRecording,
    openRecorderWithContext,
    recordingSessionActive,
    settings.defaultSkipInterval,
    skipBy,
    togglePlayPause,
  ]);

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8F9FA] dark:bg-[#0B0F17]">
        <div className="max-w-md rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-[#111827] p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Local Storage Unavailable
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{dbError}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-[#0B0F17]">
        <div className="flex flex-col items-center gap-3">
          <img src="/icon.svg" alt="Recallio" className="h-10 w-10 rounded-xl" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Opening Recallio...</p>
        </div>
      </div>
    );
  }

  const activeSubject = selectedSubjectId
    ? subjects.find((s) => s.id === selectedSubjectId) ?? null
    : null;
  const activeTopic = selectedTopicId
    ? topics.find((t) => t.id === selectedTopicId) ?? null
    : null;

  const hasMiniPlayer = Boolean(currentRecording);

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      <Sidebar
        activeTab={activeTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onNavigate={navigateToTab}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Non-Sticky Header (preserves 15% mobile sticky cap!) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827]">
          <button
            type="button"
            onClick={() => navigateToTab('home')}
            className="flex items-center gap-2 focus:outline-none"
          >
            <img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Recallio
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openRecorderWithContext(selectedSubjectId ?? undefined, selectedTopicId ?? undefined)}
              className="min-h-[40px] px-3.5 rounded-xl bg-indigo-600 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Record</span>
            </button>
          </div>
        </header>

        {/* Offline Notice Banner (shown only when navigator.onLine is false) */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900 px-4 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Offline mode — Recording and playback continue locally.</span>
          </div>
        )}

        {/* Main Workspace Content */}
        <main
          className={`flex-1 ${
            hasMiniPlayer ? 'pb-32 md:pb-20' : 'pb-20 md:pb-8'
          }`}
        >
          <Suspense
            fallback={
              <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Loading...</div>
            }
          >
            {activeTab === 'home' && (
              <Home
                subjects={subjects}
                topics={topics}
                recordings={recordings}
                activity={activity}
                onQuickRecord={() => openRecorderWithContext()}
                onOpenLibrary={() => navigateToTab('library')}
                onAddToQueue={setQueueTargetRec}
              />
            )}

            {activeTab === 'library' && !activeSubject && (
              <Library
                subjects={subjects}
                topics={topics}
                recordings={recordings}
                trashedRecordings={trashedRecordings}
                onSelectSubject={(subjId) => {
                  setSelectedSubjectId(subjId);
                  setSelectedTopicId(null);
                }}
                onOpenSearch={() => setSearchOpen(true)}
              />
            )}

            {activeTab === 'library' && activeSubject && !activeTopic && (
              <SubjectDetails
                subject={activeSubject}
                topics={topics.filter((t) => t.subjectId === activeSubject.id)}
                recordings={recordings.filter((r) => r.subjectId === activeSubject.id)}
                onBack={() => {
                  setSelectedSubjectId(null);
                  setSelectedTopicId(null);
                }}
                onSelectTopic={(topicId) => setSelectedTopicId(topicId)}
                onRecordInSubject={(subjId) => openRecorderWithContext(subjId)}
              />
            )}

            {activeTab === 'library' && activeSubject && activeTopic && (
              <TopicDetails
                subject={activeSubject}
                topic={activeTopic}
                allSubjects={subjects}
                allTopics={topics}
                recordings={recordings.filter((r) => r.topicId === activeTopic.id)}
                onBackToSubject={() => setSelectedTopicId(null)}
                onRecordInTopic={(subjId, topId) => openRecorderWithContext(subjId, topId)}
                onAddToQueue={setQueueTargetRec}
              />
            )}

            {activeTab === 'record' && (
              <RecordingStudio
                initialSubjectId={recordPreset.subjectId}
                initialTopicId={recordPreset.topicId}
                onSessionActiveChange={setRecordingSessionActive}
                onSaved={(subjId, topId) => {
                  setRecordingSessionActive(false);
                  setSelectedSubjectId(subjId);
                  setSelectedTopicId(topId);
                  setActiveTab('library');
                }}
                onCancelExit={() => {
                  setRecordingSessionActive(false);
                  setActiveTab('home');
                }}
              />
            )}

            {activeTab === 'revision' && (
              <Revision
                queues={revisionQueues}
                recordings={recordings}
                subjects={subjects}
                topics={topics}
              />
            )}

            {activeTab === 'favourites' && (
              <Favourites
                recordings={recordings}
                subjects={subjects}
                topics={topics}
                onAddToQueue={setQueueTargetRec}
              />
            )}

            {activeTab === 'settings' && <Settings recordings={recordings} />}
          </Suspense>
        </main>
      </div>

      <MiniPlayer />
      <ExpandedPlayer />
      <MobileBottomNav activeTab={activeTab} onNavigate={navigateToTab} />

      <SearchModal
        open={searchOpen}
        recordings={recordings}
        subjects={subjects}
        topics={topics}
        onClose={() => setSearchOpen(false)}
        onNavigateSubject={(subjId) => {
          guardedNavigate(() => {
            setSelectedSubjectId(subjId);
            setSelectedTopicId(null);
            setActiveTab('library');
          });
        }}
        onNavigateTopic={(subjId, topId) => {
          guardedNavigate(() => {
            setSelectedSubjectId(subjId);
            setSelectedTopicId(topId);
            setActiveTab('library');
          });
        }}
      />

      <AddToQueueModal
        recording={queueTargetRec}
        queues={revisionQueues}
        onClose={() => setQueueTargetRec(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title="Leave Recording Studio?"
        description="You have an active or unsaved recording in progress. Leaving now will discard it."
        confirmLabel="Leave & Discard"
        cancelLabel="Stay in Studio"
        destructive
        onConfirm={() => {
          const act = pendingAction;
          setPendingAction(null);
          setRecordingSessionActive(false);
          act?.();
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default function App() {
  const handleQueueTrackCompleted = useCallback(async (queueId: string, recordingId: string) => {
    const queue = await db.revisionQueues.get(queueId);
    if (!queue) return;
    if (!queue.completedIds.includes(recordingId)) {
      await updateRevisionQueue(queueId, {
        completedIds: [...queue.completedIds, recordingId],
      });
    }
  }, []);

  return (
    <ToastProvider>
      <AudioPlayerProvider onQueueTrackCompleted={handleQueueTrackCompleted}>
        <RecallioShell />
      </AudioPlayerProvider>
    </ToastProvider>
  );
}
