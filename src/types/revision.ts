export interface RevisionQueue {
  id: string;
  name: string;
  description: string;
  recordingIds: string[];
  completedIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RevisionActivity {
  date: string; // YYYY-MM-DD
  recordedSeconds: number;
  listenedSeconds: number;
  sessionsCount: number;
}
