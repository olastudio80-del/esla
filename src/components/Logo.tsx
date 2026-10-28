import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { color } from '@/theme/tokens';

/**
 * Знак esla: две капсулы, сложенные в сердце — из презентации.
 * Геометрия перенесена один в один, поэтому цифры здесь «магические»
 * намеренно: это обводка логотипа, а не вычисляемая разметка.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  // Пропорции исходного viewBox: 95.4 × 76.7
  const height = (size * 76.7) / 95.4;
  return (
    <Svg width={size} height={height} viewBox="12.3 22.8 95.4 76.7">
      <Defs>
        <ClipPath id="half-left">
          <Rect x="0" y="0" width="58.7" height="120" />
        </ClipPath>
        <ClipPath id="half-right">
          <Rect x="61.3" y="0" width="60" height="120" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#half-right)">
        <G transform="rotate(44 47 85)">
          <Rect x="29" y="7" width="36" height="96" rx="18" fill={color.pillSage} />
        </G>
      </G>
      <G clipPath="url(#half-left)">
        <G transform="rotate(-44 73 85)">
          <Rect x="55" y="7" width="36" height="96" rx="18" fill={color.pillPink} />
        </G>
      </G>
      {/* Блики — «шов» капсулы */}
      <Path
        d="M34.5 30.8A11.5 11.5 0 0 1 24.4 32.6"
        fill="none"
        stroke={color.card}
        strokeWidth={3.4}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path
        d="M85.5 30.8A11.5 11.5 0 0 0 95.6 32.6"
        fill="none"
        stroke={color.card}
        strokeWidth={3.4}
        strokeLinecap="round"
        opacity={0.85}
      />
    </Svg>
  );
}
