/**
 * Цветовые токены и шкала типографики перенесены из презентации esla:
 * пастельный мир «вырезанных» форм, сливовый логотип, капсула-сердце.
 * Единственный источник правды по цвету — менять только здесь.
 */

export const color = {
  // Бумага и поверхности
  paper: '#F7EEE4',
  paperDeep: '#ECDDCF',
  card: '#FFF9F3',
  app: '#FBF4EC',

  // Текст и линии
  ink: '#3B2D43',
  inkSoft: '#6E5E76',
  line: '#E4D4C7',

  // Бренд
  plum: '#5A2050',
  pillPink: '#EFA3A6',
  pillSage: '#93AD82',

  // Акценты — каждый закреплён за своим смыслом в интерфейсе
  blush: '#F0A9AB',
  blushSoft: '#F8D6D4',
  peach: '#F5C3A5',
  peachSoft: '#FBE4D3',
  lilac: '#BBA8DA',
  lilacSoft: '#E6DDF2',
  sage: '#A6C1A0',
  sageSoft: '#DDE9D7',
  sageDeep: '#4F7D4D',
  sky: '#A3BBDB',
  skySoft: '#DDE6F3',
  rose: '#D46E7B',
} as const;

/** Смысловые роли: дозы, статусы, разделы. */
export const semantic = {
  doseNow: color.blushSoft,
  doseTaken: color.sageSoft,
  doseTakenText: color.sageDeep,
  doseWaiting: color.lilacSoft,
  doseMissed: color.rose,
  assistant: color.lilac,
  assistantSoft: color.lilacSoft,
  history: color.sky,
  historySoft: color.skySoft,
  bracelet: color.peach,
  braceletSoft: color.peachSoft,
  family: color.blush,
  familySoft: color.blushSoft,
  danger: color.rose,
} as const;

export const radius = { sm: 12, md: 18, lg: 26, xl: 34, pill: 999 } as const;

export const space = (n: number) => n * 4;

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayExtra: 'BricolageGrotesque_800ExtraBold',
  body: 'Onest_400Regular',
  bodyMedium: 'Onest_500Medium',
  bodySemi: 'Onest_600SemiBold',
  bodyBold: 'Onest_700Bold',
  logo: 'Nunito_900Black',
} as const;

/**
 * Базовая шкала рассчитана на пожилого пользователя: минимум 15pt,
 * основной текст 18pt. Настройка «крупный шрифт» множит всю шкалу,
 * поэтому размеры читаются через useType(), а не напрямую.
 */
export const typeScale = {
  caption: 15,
  body: 18,
  bodyLarge: 20,
  subtitle: 22,
  title: 28,
  headline: 34,
  display: 44,
  hero: 56,
} as const;

export type TypeKey = keyof typeof typeScale;

/** Множители настройки размера текста. */
export const textSizeFactor = { normal: 1, large: 1.15, huge: 1.3 } as const;
export type TextSize = keyof typeof textSizeFactor;

export const shadow = {
  card: {
    shadowColor: '#3B2D43',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#3B2D43',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
} as const;

/** Минимальная площадь нажатия — крупнее обычных 44pt: моторика пожилых. */
export const MIN_TOUCH = 56;
