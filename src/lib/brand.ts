import type { CSSProperties } from 'react';
import type { Site } from './api';

const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) =>
  channels(hex)
    .map((i) => i / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: string, b: string) => {
  const colors = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (colors[0] + 0.05) / (colors[1] + 0.05);
};
const shift = (color: string, target: string, p: number) =>
  '#' +
  channels(color)
    .map((n, i) =>
      Math.round(n + (channels(target)[i] - n) * p)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
function readable(color: string, background: string) {
  for (let step = 0; step <= 20; step++) {
    const candidate = shift(
      color,
      luminance(background) > 0.5 ? '#000000' : '#ffffff',
      step / 20,
    );
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return luminance(background) > 0.5 ? '#000000' : '#ffffff';
}
export function brandStyle(site?: Site | null): CSSProperties | undefined {
  if (!site) return;
  const dark = site.scheme === 'dark',
    surface = dark ? '#1c1b22' : '#ffffff';
  const primary = readable(site.primary_color, surface),
    secondary = readable(site.secondary_color, surface);
  return {
    '--brand-primary': primary,
    '--brand-secondary': secondary,
    '--brand-accent': site.accent_color,
    '--brand-ink': contrast(primary, '#ffffff') >= 4.5 ? '#ffffff' : '#14141a',
    colorScheme: site.scheme,
  } as CSSProperties;
}
export const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => Array.from(w)[0])
    .join('')
    .toUpperCase();
