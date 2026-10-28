import type { ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { color as palette } from '@/theme/tokens';

/**
 * Иконки перенесены из презентации esla: один набор, одна сетка 24×24,
 * обводка без заливки. Контуры скопированы из деки, чтобы приложение
 * выглядело ровно так, как его показывали.
 */
const ICONS = {
  check: () => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: () => <Path d="M7 7l10 10M17 7 7 17" />,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  left: () => <Path d="M15 5l-7 7 7 7" />,
  right: () => <Path d="M9 5l7 7-7 7" />,
  home: () => (
    <>
      <Path d="M4 11l8-6.5 8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <Path d="M10 20.5v-5h4v5" />
    </>
  ),
  pill: () => (
    <G transform="rotate(-40 12 12)">
      <Rect x="3.5" y="8.5" width="17" height="7" rx="3.5" />
      <Path d="M12 8.5v7" />
    </G>
  ),
  mic: () => (
    <>
      <Rect x="9" y="3" width="6" height="11" rx="3" />
      <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  heart: () => (
    <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  ),
  watch: () => (
    <>
      <Rect x="6.5" y="6.5" width="11" height="11" rx="3.2" />
      <Path d="M9 6.5V3h6v3.5M9 17.5V21h6v-3.5M9 12h1.6l1-2 1.4 4 1-2h1" />
    </>
  ),
  phone: () => (
    <>
      <Rect x="6.5" y="2.5" width="11" height="19" rx="3" />
      <Path d="M10.5 18.5h3" />
    </>
  ),
  bell: () => (
    <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />
  ),
  moon: () => <Path d="M19.5 14.5A7.8 7.8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z" />,
  activity: () => <Path d="M3 12h4l2.5-6 4.5 12 2.5-6H21" />,
  users: () => (
    <>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <Circle cx="17" cy="9" r="2.5" />
      <Path d="M16.5 14c2.7.2 4.5 2.3 4.5 5" />
    </>
  ),
  stethoscope: () => (
    <>
      <Path d="M6 3.5V8a4 4 0 0 0 8 0V3.5M10 12v2.5a5 5 0 0 0 10 0v-1.5" />
      <Circle cx="20" cy="11" r="2" />
    </>
  ),
  share: () => (
    <Path d="M12 4v11M7.5 8.5 12 4l4.5 4.5M5 13.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5" />
  ),
  file: () => (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <Path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  spark: () => (
    <Path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6-4.6-1.7 4.6-1.7zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  ),
  chat: () => <Path d="M20 12.5a7.5 7 0 0 1-11.2 6.1L4 20l1.4-4.1A7.5 7 0 1 1 20 12.5z" />,
  search: () => (
    <>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="M16 16l4 4" />
    </>
  ),
  shield: () => (
    <>
      <Path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z" />
      <Path d="M9 12l2 2 4-4" />
    </>
  ),
  alert: () => (
    <>
      <Path d="M12 3.5 21.5 20h-19z" />
      <Path d="M12 10v4.5M12 17.2h.01" />
    </>
  ),
  flash: () => <Path d="M13 3 6 13.5h5.5L10 21l8-11h-5.5z" />,
  camera: () => (
    <>
      <Path d="M4 8.5h3l1.5-2.5h7L17 8.5h3V19H4z" />
      <Circle cx="12" cy="13.5" r="3.3" />
    </>
  ),
  call: () => (
    <Path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />
  ),
  settings: () => (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 3v2.5M12 18.5V21M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color = palette.ink,
  strokeWidth = 1.9,
  filled = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Для сердца в показателях пульса: тот же контур, но залитый. */
  filled?: boolean;
}) {
  const children: ReactNode = ICONS[name]();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </G>
    </Svg>
  );
}
