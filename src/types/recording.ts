export interface Recording {
  id: string;
  subjectId: string;
  topicId: string;
  title: string;
  description: string;
  tags: string[];
  duration: number;
  mimeType: string;
  audioSize: number;
  isFavourite: boolean;
  isArchived: boolean;
  deletedAt: number | null;
  lastPosition: number;
  playbackSpeed: number;
  playCount: number;
  lastPlayedAt: number | null;
  createdAt: number;
  updatedAt: number;
  isSample?: boolean;
}

export interface AudioBlobRecord {
  id: string;
  blob: Blob;
  waveformPeaks?: number[];
}

export interface Bookmark {
  id: string;
  recordingId: string;
  timestamp: number;
  label: string;
  createdAt: number;
}

export type RecordingFilter =
  | 'all'
  | 'recent_added'
  | 'recent_played'
  | 'favourites'
  | 'most_played'
  | 'never_played'
  | 'archived';

export type RecordingSort =
  | 'newest'
  | 'oldest'
  | 'alphabetical'
  | 'longest'
  | 'shortest';
