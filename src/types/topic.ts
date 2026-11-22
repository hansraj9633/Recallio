export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  description?: string;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}
