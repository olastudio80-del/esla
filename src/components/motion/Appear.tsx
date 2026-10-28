import { useEffect, type PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { motion as timing } from '@/theme/tokens';

/**
 * Сколько элементов подряд ещё получают задержку.
 *
 * Без ограничения восьмая карточка в списке появлялась бы через полсекунды
 * после первой — человек успевает решить, что приложение зависло.
 */
const MAX_STAGGER = 4;

/** Насколько элемент приподнят в начале появления. */
const SHIFT = 14;

/**
 * Появление элемента при открытии экрана: проявление и короткий подъём.
 *
 * Движение здесь только по вертикали и только на 14 точек: карточка не
 * выезжает из-за края и не меняет своё место, поэтому палец, уже
 * занесённый над кнопкой, попадает туда, куда целился.
 *
 * `index` задаёт очередь: соседние элементы появляются один за другим, как
 * в презентации. При сокращённом движении остаётся только проявление, при
 * выключенном — ничего.
 */
export function Appear({
  index = 0,
  children,
  style,
}: PropsWithChildren<{ index?: number; style?: StyleProp<ViewStyle> }>) {
  const { entrance, level } = useMotion();
  const progress = useSharedValue(entrance ? 0 : 1);
  const shift = level === 'full' ? SHIFT : 0;

  useEffect(() => {
    if (!entrance) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      Math.min(index, MAX_STAGGER) * timing.stagger,
      withTiming(1, { duration: timing.enter, easing: Easing.out(Easing.cubic) }),
    );
  }, [entrance, index, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * shift }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
