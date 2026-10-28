import { useEffect, type PropsWithChildren } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { motion as timing } from '@/theme/tokens';

/** Удар и подудар: так бьётся сердце, а знак esla — это сердце из капсул. */
const BEAT = [
  { to: 1.07, duration: 160 },
  { to: 1, duration: 190 },
  { to: 1.035, duration: 130 },
  { to: 1, duration: 190 },
] as const;

const BEAT_TIME = BEAT.reduce((sum, step) => sum + step.duration, 0);

/**
 * Биение логотипа.
 *
 * Пауза между ударами длиннее самих ударов — иначе знак не бьётся, а
 * дрожит. Увеличение всего на 7%: движение видно краем глаза и не
 * перетягивает внимание с того, что надо сделать на экране.
 */
export function Heartbeat({ children }: PropsWithChildren) {
  const { ambient } = useMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!ambient) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(
        ...BEAT.map((step, i) =>
          withTiming(step.to, {
            duration: step.duration,
            // Удар резкий, возврат мягкий.
            easing: i % 2 === 0 ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad),
          }),
        ),
        withTiming(1, { duration: Math.max(timing.heartbeat - BEAT_TIME, 400) }),
      ),
      -1,
      false,
    );
  }, [ambient, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={animated}>{children}</Animated.View>;
}
