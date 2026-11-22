import React from 'react';
import {
  Atom,
  BookOpen,
  Calculator,
  Compass,
  Cpu,
  FlaskConical,
  Globe,
  Landmark,
  Layers,
  Scale,
} from 'lucide-react';
import { SUBJECT_COLORS, type SubjectColor, type SubjectIcon } from '../../types/subject';

const ICON_MAP: Record<SubjectIcon, React.FC<{ className?: string }>> = {
  book: BookOpen,
  compass: Compass,
  cpu: Cpu,
  flask: FlaskConical,
  layers: Layers,
  landmark: Landmark,
  calculator: Calculator,
  globe: Globe,
  scale: Scale,
  atom: Atom,
};

export const SUBJECT_ICON_OPTIONS: { value: SubjectIcon; label: string }[] = [
  { value: 'book', label: 'Book' },
  { value: 'compass', label: 'Engineering' },
  { value: 'atom', label: 'Science' },
  { value: 'flask', label: 'Chemistry' },
  { value: 'cpu', label: 'Computing' },
  { value: 'calculator', label: 'Mathematics' },
  { value: 'layers', label: 'Architecture' },
  { value: 'landmark', label: 'History' },
  { value: 'scale', label: 'Law' },
  { value: 'globe', label: 'Geography' },
];

export const SubjectIconMark: React.FC<{
  icon: SubjectIcon;
  color: SubjectColor;
  size?: 'sm' | 'md' | 'lg';
}> = ({ icon, color, size = 'md' }) => {
  const IconComp = ICON_MAP[icon] ?? BookOpen;
  const palette = SUBJECT_COLORS[color] ?? SUBJECT_COLORS.indigo;

  const sizeClass =
    size === 'sm'
      ? 'h-8 w-8 rounded-lg'
      : size === 'lg'
        ? 'h-12 w-12 rounded-xl'
        : 'h-10 w-10 rounded-xl';
  const iconClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';

  return (
    <div
      className={`flex items-center justify-center shrink-0 ${sizeClass} ${palette.bg} ${palette.text}`}
      aria-hidden="true"
    >
      <IconComp className={iconClass} />
    </div>
  );
};
