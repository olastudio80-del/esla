import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, space } from '@/theme/tokens';

/**
 * Основа экрана: фон-«бумага», безопасные отступы и прокрутка.
 * Боковые отступы одинаковые во всём приложении, чтобы экраны не «прыгали».
 */
export function Screen({
  children,
  scroll = true,
  footer,
  tint = color.paper,
}: PropsWithChildren<{
  scroll?: boolean;
  /** Закреплённый низ: главная кнопка не должна уезжать за прокрутку. */
  footer?: ReactNode;
  tint?: string;
}>) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + space(3),
    paddingHorizontal: space(5),
  };

  return (
    <View style={{ flex: 1, backgroundColor: tint }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            ...padding,
            // Запас снизу под панель вкладок: она перекрывает конец
            // прокрутки, а последним там обычно стоит действие.
            paddingBottom: space(24) + (footer ? 0 : insets.bottom),
            gap: space(4),
          }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, ...padding, gap: space(4) }}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: space(5),
            paddingTop: space(3),
            paddingBottom: insets.bottom + space(3),
            backgroundColor: tint,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
