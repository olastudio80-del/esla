import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useMotion } from '@/theme/motion';
import { color, motion as timing } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Линия кардиограммы под значением пульса — как в макете проекта.
 *
 * Рисуется в координатах 0…600 по ширине и 0…100 по высоте, растягивается
 * по месту. Под основной бледной линией пробегает яркий импульс: это
 * единственное постоянное движение на экране состояния, и оно уместно —
 * экран про живого человека, и видно, что данные живые.
 *
 * При выключенном движении остаётся статичная линия: форма кардиограммы
 * сама по себе говорит, что это пульс.
 */
const WAVE = buildWave();

function buildWave(): string {
  // Один удар: ровная линия, зубец P, комплекс QRS, зубец T.
  const beat = (x: number) =>
    `L${x + 8} 50 L${x + 14} 42 L${x + 20} 50 L${x + 30} 50 ` +
    `L${x + 34} 62 L${x + 40} 14 L${x + 46} 78 L${x + 52} 50 ` +
    `L${x + 64} 50 L${x + 72} 38 L${x + 80} 50`;

  let d = 'M0 50';
  for (let x = 0; x < 600; x += 100) d += ` ${beat(x)} L${x + 100} 50`;
  return d;
}

export function ECGLine({
  height = 48,
  tint = color.rose,
  base = color.blushSoft,
}: {
  height?: number;
  tint?: string;
  base?: string;
}) {
  const { ambient } = useMotion();
  const offset = useSharedValue(600);

  useEffect(() => {
    if (!ambient) {
      offset.value = 0;
      return;
    }
    offset.value = 600;
    offset.value = withRepeat(
      withTiming(-600, { duration: timing.pulse, easing: Easing.linear }),
      -1,
      false,
    );
  }, [ambient, offset]);

  const pulseProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={{ height }}>
      <Svg width="100%" height={height} viewBox="0 0 600 100" preserveAspectRatio="none">
        <Path
          d={WAVE}
          stroke={base}
          strokeWidth={5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {ambient ? (
          <AnimatedPath
            d={WAVE}
            stroke={tint}
            strokeWidth={6}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            // Короткий штрих на длинном промежутке — это и есть бегущий импульс.
            strokeDasharray="70 530"
            animatedProps={pulseProps}
          />
        ) : null}
      </Svg>
    </View>
  );
}
