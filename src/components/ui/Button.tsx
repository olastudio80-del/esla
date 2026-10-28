import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

import { useMotion } from '@/theme/motion';
import { MIN_TOUCH, color, radius, space } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Насколько кнопка проседает под пальцем.
 *
 * Три процента: нажатие ощущается, но кнопка не уезжает из-под пальца —
 * на главной кнопке «Ichdim» это важнее, чем выразительность.
 */
const SQUEEZE = 0.03;

type Variant = 'primary' | 'accent' | 'soft' | 'danger' | 'ghost';

const STYLES: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: color.ink, fg: color.card },
  accent: { bg: color.rose, fg: color.card },
  soft: { bg: color.card, fg: color.ink, border: color.line },
  danger: { bg: color.rose, fg: color.card },
  ghost: { bg: 'transparent', fg: color.ink },
};

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  /** Крупная кнопка главного действия («Ichdim») — выше и с большим шрифтом. */
  large?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Кнопка приложения. Минимальная высота намеренно больше системных 44pt:
 * у пожилого пользователя хуже точность нажатия, и промах по кнопке
 * «Ichdim» означает незафиксированный приём лекарства.
 *
 * Отклик вибрацией — не украшение: он подтверждает нажатие тому, кто плохо
 * видит и не уверен, сработало ли.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  large = false,
  disabled = false,
  busy = false,
  style,
}: ButtonProps) {
  const s = STYLES[variant];
  const inactive = disabled || busy;
  const { level } = useMotion();
  const squeeze = level === 'off' ? 0 : SQUEEZE;
  const press = useSharedValue(0);

  // Притухание и просадка — одно движение: одно состояние, один стиль.
  const animated = useAnimatedStyle(() => ({
    opacity: inactive ? 0.5 : 1 - press.value * 0.15,
    transform: [{ scale: 1 - press.value * squeeze }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 170 });
      }}
      style={[
        {
          minHeight: large ? 68 : MIN_TOUCH,
          paddingHorizontal: space(5),
          borderRadius: large ? radius.md : radius.sm,
          backgroundColor: s.bg,
          borderWidth: s.border ? 1.5 : 0,
          borderColor: s.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space(2),
        },
        style,
        animated,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={s.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={large ? 26 : 22} color={s.fg} strokeWidth={2.4} /> : null}
          <Txt variant={large ? 'subtitle' : 'bodyLarge'} weight="bold" color={s.fg}>
            {label}
          </Txt>
        </>
      )}
    </AnimatedPressable>
  );
}

/** Нажимаемая строка-пилюля: быстрые ответы помощнику, выбор времени. */
export function Pill({
  label,
  onPress,
  selected = false,
  tint = color.lilacSoft,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  tint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: space(4),
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: selected ? color.ink : tint,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Txt weight="semibold" color={selected ? color.card : color.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Круглая кнопка-иконка: «назад», «настройки». */
export function IconButton({
  name,
  onPress,
  label,
  tint = color.card,
  iconColor = color.ink,
}: {
  name: IconName;
  onPress: () => void;
  /** Подпись для озвучки — иконка сама по себе незрячему ничего не говорит. */
  label: string;
  tint?: string;
  iconColor?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: radius.md,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon name={name} size={24} color={iconColor} />
    </Pressable>
  );
}

/** Разделитель между блоками: воздух вместо линий, как в презентации. */
export function Gap({ size = 4 }: { size?: number }) {
  return <View style={{ height: space(size) }} />;
}
