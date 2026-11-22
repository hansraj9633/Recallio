import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { SUBJECT_COLORS, type Subject, type SubjectColor, type SubjectIcon } from '../../types/subject';
import { SUBJECT_ICON_OPTIONS, SubjectIconMark } from '../common/SubjectIconMark';

interface SubjectModalProps {
  open: boolean;
  initial?: Subject | null;
  onClose: () => void;
  onSave: (data: { name: string; color: SubjectColor; icon: SubjectIcon }) => Promise<void>;
}

const COLOR_KEYS = Object.keys(SUBJECT_COLORS) as SubjectColor[];

export const SubjectModal: React.FC<SubjectModalProps> = ({ open, initial, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState<SubjectColor>('indigo');
  const [icon, setIcon] = useState<SubjectIcon>('book');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setColor(initial?.color ?? 'indigo');
    setIcon(initial?.icon ?? 'book');
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), color, icon });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {initial ? 'Edit Subject' : 'New Subject'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <SubjectIconMark icon={icon} color={color} size="lg" />
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Subject Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Civil Engineering"
              autoFocus
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Colour Accent
          </label>
          <div className="grid grid-cols-8 gap-2">
            {COLOR_KEYS.map((key) => {
              const c = SUBJECT_COLORS[key];
              const selected = color === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-label={c.label}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center border transition-all ${
                    selected
                      ? 'border-slate-900 dark:border-white scale-105'
                      : 'border-transparent hover:scale-105'
                  } ${c.bg}`}
                >
                  <span className={`h-4 w-4 rounded-full ${c.dot}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Icon
          </label>
          <div className="grid grid-cols-5 gap-2">
            {SUBJECT_ICON_OPTIONS.map((opt) => {
              const selected = icon === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(opt.value)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 px-1 text-[11px] transition-colors ${
                    selected
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <SubjectIconMark icon={opt.value} color={color} size="sm" />
                  <span className="truncate max-w-full">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Subject'}
          </button>
        </div>
      </form>
    </div>
  );
};
