/**
 * useTextSize — returns scaled font sizes based on the user's textSize preference.
 * Screens import this and replace hardcoded font sizes with fs.body, fs.label, etc.
 *
 * Scale factors:
 *   small  → 0.875×  (shrink ~12%)
 *   medium → 1×      (default, no change)
 *   large  → 1.2×    (grow ~20%)
 */
import { useSettings } from '../store/settings';

const SCALES: Record<'small' | 'medium' | 'large', number> = {
  small:  0.875,
  medium: 1,
  large:  1.2,
};

/** Returns a function that scales any base font size by the user's preference. */
export function useTextScale(): (base: number) => number {
  const textSize = useSettings((s) => s.textSize) ?? 'medium';
  const scale = SCALES[textSize];
  return (base: number) => Math.round(base * scale);
}
