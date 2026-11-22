export type SubjectColor =
  | 'indigo'
  | 'sky'
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'slate';

export type SubjectIcon =
  | 'book'
  | 'compass'
  | 'cpu'
  | 'flask'
  | 'layers'
  | 'landmark'
  | 'calculator'
  | 'globe'
  | 'scale'
  | 'atom';

export interface Subject {
  id: string;
  name: string;
  color: SubjectColor;
  icon: SubjectIcon;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export const SUBJECT_COLORS: Record<
  SubjectColor,
  { label: string; bg: string; text: string; dot: string; ring: string }
> = {
  indigo: {
    label: 'Indigo',
    bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    text: 'text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-600 dark:bg-indigo-400',
    ring: 'ring-indigo-500/30',
  },
  sky: {
    label: 'Sky',
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-600 dark:bg-sky-400',
    ring: 'ring-sky-500/30',
  },
  teal: {
    label: 'Teal',
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    text: 'text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-600 dark:bg-teal-400',
    ring: 'ring-teal-500/30',
  },
  emerald: {
    label: 'Emerald',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    ring: 'ring-emerald-500/30',
  },
  amber: {
    label: 'Amber',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-600 dark:bg-amber-400',
    ring: 'ring-amber-500/30',
  },
  rose: {
    label: 'Rose',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-600 dark:bg-rose-400',
    ring: 'ring-rose-500/30',
  },
  violet: {
    label: 'Violet',
    bg: 'bg-violet-50 dark:bg-violet-950/50',
    text: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-600 dark:bg-violet-400',
    ring: 'ring-violet-500/30',
  },
  slate: {
    label: 'Slate',
    bg: 'bg-slate-100 dark:bg-slate-800/80',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-600 dark:bg-slate-400',
    ring: 'ring-slate-500/30',
  },
};
