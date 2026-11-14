import type { FC } from 'react';
import { useEffect } from 'react';

export type GlassVariant = 'clear' | 'frosted' | 'liquid';

interface GlassSwitcherProps {
  value: GlassVariant;
  onChange: (variant: GlassVariant) => void;
}

const OPTIONS: readonly GlassVariant[] = ['clear', 'frosted', 'liquid'];

export const GlassSwitcher: FC<GlassSwitcherProps> = ({ value, onChange }) => {
  useEffect(() => {
    window.localStorage.setItem('vital-orbit-glass', value);
  }, [value]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="crew-glass-switcher" aria-label="Glass variant">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
};
