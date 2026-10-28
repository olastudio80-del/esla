import { TextInput, View, type TextInputProps } from 'react-native';

import { Caption } from './Card';

import { useType } from '@/i18n';
import { color, font, radius, space } from '@/theme/tokens';

export type InputProps = TextInputProps & {
  /** Подпись над полем: без неё пожилой человек не поймёт, что вводить. */
  label?: string;
  /** Подсветить рамку: поле в фокусе работы, например название лекарства. */
  accent?: boolean;
};

export function Input({ label, accent = false, style, ...rest }: InputProps) {
  const type = useType();
  return (
    <View style={{ gap: space(2) }}>
      {label ? <Caption>{label}</Caption> : null}
      <TextInput
        placeholderTextColor={color.inkSoft}
        style={[
          {
            minHeight: 60,
            paddingHorizontal: space(4),
            paddingVertical: space(3),
            borderRadius: radius.md,
            backgroundColor: color.card,
            borderWidth: 2,
            borderColor: accent ? color.pillPinkLine : color.lineStrong,
            fontFamily: font.bodySemi,
            fontSize: type('bodyLarge'),
            color: color.ink,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
