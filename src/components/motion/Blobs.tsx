import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { color, motion as timing } from '@/theme/tokens';

/**
 * Форма пятна: четыре разных радиуса вместо круга.
 *
 * Круг при вращении остаётся кругом, а такая фигура кажется текучей —
 * это и есть «перетекающие формы» из презентации, только вращением и
 * растяжением вместо настоящей морфинг-анимации контура. Разницы на глаз
 * нет, а стоит это один трансформ на UI-потоке: на дешёвом телефоне,
 * который и будет у человека в руках, настоящий морфинг пути заметно
 * тормозит.
 */
const SHAPE = { tl: 0.52, tr: 0.41, br: 0.56, bl: 0.38 } as const;

type Spec = {
  tint: string;
  /** Доля ширины экрана. */
  size: number;
  /** Смещение центра от левого верхнего угла, в долях ширины. */
  x: number;
  y: number;
  turn: number;
  stretch: number;
  phase: number;
};

/**
 * Пятна уведены за края экрана: внутри остаются только их склоны, без
 * заметной границы. Поэтому текст поверх лежит на ровном цвете.
 */
const LAYOUT: Spec[] = [
  { tint: color.blushSoft, size: 1.15, x: -0.45, y: -0.35, turn: 18, stretch: 0.1, phase: 0 },
  { tint: color.lilacSoft, size: 0.95, x: 0.6, y: 0.18, turn: -22, stretch: 0.12, phase: 2_400 },
  { tint: color.peachSoft, size: 1.05, x: -0.2, y: 0.72, turn: 14, stretch: 0.09, phase: 4_800 },
];

/**
 * Живой фон экрана: несколько пастельных пятен, медленно перетекающих
 * друг за друга.
 *
 * Полный цикл — четырнадцать секунд: на таком движении глаз не ловит
 * перемещение, оно читается как дыхание. Показывается только при полном
 * уровне движения; при сокращённом остаются те же пятна, но неподвижные,
 * чтобы экран не терял вид из презентации.
 */
export function Blobs({ opacity = 0.75 }: { opacity?: number }) {
  const { ambient, level } = useMotion();
  const { width } = useWindowDimensions();

  if (level === 'off') return null;

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none' }]}>
      {LAYOUT.map((spec) => (
        <Blob key={spec.tint} spec={spec} width={width} opacity={opacity} animate={ambient} />
      ))}
    </View>
  );
}

function Blob({
  spec,
  width,
  opacity,
  animate,
}: {
  spec: Spec;
  width: number;
  opacity: number;
  animate: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      progress.value = 0;
      return;
    }
    progress.value = withDelay(
      spec.phase,
      withRepeat(
        withTiming(1, { duration: timing.ambient, easing: Easing.inOut(Easing.sin) }),
        -1,
        // Назад тем же путём: на стыке циклов пятно не прыгает.
        true,
      ),
    );
  }, [animate, progress, spec.phase]);

  const size = width * spec.size;
  const animated = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${progress.value * spec.turn}deg` },
      { scaleX: 1 + progress.value * spec.stretch },
      // Сжатие по другой оси: площадь пятна остаётся примерно той же.
      { scaleY: 1 - progress.value * spec.stretch * 0.7 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: width * spec.x,
          top: width * spec.y,
          width: size,
          height: size,
          backgroundColor: spec.tint,
          opacity,
          borderTopLeftRadius: size * SHAPE.tl,
          borderTopRightRadius: size * SHAPE.tr,
          borderBottomRightRadius: size * SHAPE.br,
          borderBottomLeftRadius: size * SHAPE.bl,
        },
        animated,
      ]}
    />
  );
}
