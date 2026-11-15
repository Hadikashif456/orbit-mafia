import type { FC } from 'react';

export type GlassVariant = 'clear' | 'frosted' | 'liquid';

interface GlassSwitcherProps {
  value?: GlassVariant;
  onChange?: (variant: GlassVariant) => void;
}

export const GlassSwitcher: FC<GlassSwitcherProps> = () => {
  return null;
};
