export type ThemePreference = 'light' | 'dark' | 'system';
export type RecordingQuality = 'standard' | 'high';

export interface UserSettings {
  id: 'user_settings';
  theme: ThemePreference;
  defaultPlaybackSpeed: number;
  defaultSkipInterval: number;
  autoPlayNext: boolean;
  autoSaveProgress: boolean;
  recordingQuality: RecordingQuality;
  sampleDataDismissed: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: 'user_settings',
  theme: 'system',
  defaultPlaybackSpeed: 1,
  defaultSkipInterval: 10,
  autoPlayNext: true,
  autoSaveProgress: true,
  recordingQuality: 'high',
  sampleDataDismissed: false,
};

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const SKIP_INTERVALS = [5, 10, 15, 30] as const;
