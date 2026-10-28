import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Txt } from './Txt';

import { color, radius, shadow, space } from '@/theme/tokens';

/** Карточка: крупный радиус и мягкая тень — язык форм из презентации. */
export function Card({
  children,
  tint = color.card,
  padded = true,
  raised = false,
  style,
}: PropsWithChildren<{
  tint?: string;
  padded?: boolean;
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <View
      style={[
        {
          backgroundColor: tint,
          borderRadius: radius.xl,
          padding: padded ? space(5) : 0,
        },
        raised ? shadow.raised : shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Надпись-ярлык над блоком: «HOZIR DORI VAQTI». */
export function Caption({ children }: PropsWithChildren) {
  return (
    <Txt
      variant="caption"
      weight="semibold"
      color={color.inkSoft}
      style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}
    >
      {children}
    </Txt>
  );
}

/** Заголовок раздела с подписью. */
export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ gap: space(1) }}>
      <Txt variant="title" weight="display">
        {title}
      </Txt>
      {hint ? (
        <Txt variant="body" color={color.inkSoft}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
