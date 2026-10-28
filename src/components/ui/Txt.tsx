import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useType } from '@/i18n';
import { usePrefs } from '@/store/prefs';
import { color as palette, font, type TypeKey } from '@/theme/tokens';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'display' | 'displayExtra' | 'logo';

const FAMILY: Record<Weight, string> = {
  regular: font.body,
  medium: font.bodyMedium,
  semibold: font.bodySemi,
  bold: font.bodyBold,
  display: font.display,
  displayExtra: font.displayExtra,
  logo: font.logo,
};

/** При включённом жирном тексте каждое начертание становится на ступень тяжелее. */
const BOLDER: Record<Weight, Weight> = {
  regular: 'semibold',
  medium: 'semibold',
  semibold: 'bold',
  bold: 'bold',
  display: 'displayExtra',
  displayExtra: 'displayExtra',
  logo: 'logo',
};

/** Межстрочное расстояние: заголовки плотнее, текст свободнее для чтения. */
const LINE_HEIGHT: Record<Weight, number> = {
  regular: 1.45,
  medium: 1.45,
  semibold: 1.4,
  bold: 1.35,
  display: 1.1,
  displayExtra: 1.05,
  logo: 1.1,
};

export type TxtProps = TextProps & {
  variant?: TypeKey;
  weight?: Weight;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
};

/**
 * Весь текст приложения идёт через этот компонент: он один знает про
 * настройку «размер текста» и про то, какое начертание к какому размеру.
 *
 * Системное увеличение шрифта не отключаем — пожилой человек мог включить
 * его специально, — но ограничиваем множителем 1.5, иначе вместе с нашей
 * настройкой разметка рвётся.
 */
export function Txt({
  variant = 'body',
  weight: requestedWeight = 'regular',
  color = palette.ink,
  align,
  style,
  ...rest
}: TxtProps) {
  const type = useType();
  const { prefs } = usePrefs();
  const weight = prefs.boldText ? BOLDER[requestedWeight] : requestedWeight;
  const size = type(variant);
  return (
    <RNText
      maxFontSizeMultiplier={1.5}
      style={[
        {
          fontFamily: FAMILY[weight],
          fontSize: size,
          lineHeight: Math.round(size * LINE_HEIGHT[weight]),
          color,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}
