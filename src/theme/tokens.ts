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

  // Текст и линии.
  // inkSoft затемнён с #6E5E76 до контраста 7.2 с бумагой — это уровень AAA.
  // Исходный пастельный оттенок давал 5.2: формально проходит, но для
  // пожилого глаза этого мало, а весь второстепенный текст набран им.
  ink: '#3B2D43',
  inkSoft: '#564A5C',
  line: '#E4D4C7',
  // Видимая рамка полей ввода. line даёт контраст 1.4 — для слабого зрения
  // такой рамки просто нет, а это границы полей, в которые надо печатать.
  // Затемнён с #998F86: на бумаге тот давал 2.76, то есть не дотягивал до
  // требуемых для элементов управления 3.0. Теперь 3.15 на бумаге и 3.46
  // на карточке.
  lineStrong: '#8F857C',

  // Бренд
  plum: '#5A2050',
  pillPink: '#EFA3A6',
  // Рамка выделенного поля: pillPink на карточке даёт 1.92 и как граница
  // не читается. Для заливок и логотипа pillPink остаётся как есть —
  // затемнять там нечего, туда никто не смотрит как на рамку.
  pillPinkLine: '#D4616A',
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
  // Затемнён с #4F7D4D: на sageSoft давал 3.8, теперь 4.6.
  sageDeep: '#466F44',
  sky: '#A3BBDB',
  skySoft: '#DDE6F3',
  // rose остаётся для заливок и акцентов, но текстом и фоном под белым
  // текстом не годится: на бумаге давал 2.9, под белым текстом 3.2.
  rose: '#D46E7B',
  // Для текста на светлом фоне.
  roseText: '#A1545E',
  // Для заливки под белым текстом — карточка вызова скорой.
  roseDeep: '#AB5963',
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
  danger: color.roseDeep,
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

/**
 * Множители размера текста.
 *
 * Верхняя ступень намеренно большая: 1.3 для слабовидящего человека —
 * это почти ничего. На 1.8 основной текст становится 32pt, и разметка
 * обязана это выдержать, поэтому фиксированных высот и обрезки строк
 * в компонентах нет.
 */
export const textSizeFactor = { normal: 1, large: 1.2, huge: 1.45, max: 1.8 } as const;
export type TextSize = keyof typeof textSizeFactor;

/** Насколько живой интерфейс: выбирает сам пользователь. */
export type MotionLevel = 'full' | 'reduced' | 'off';

/**
 * Длительности движения.
 *
 * Появление быстрое: человек ждёт содержимое, а не представление.
 * Фоновое движение, наоборот, очень медленное — оно должно ощущаться
 * как дыхание, а не привлекать внимание и не отвлекать от кнопки.
 */
export const motion = {
  /** Появление элемента на экране. */
  enter: 420,
  /** Задержка между соседними элементами при появлении. */
  stagger: 70,
  /** Медленное фоновое движение форм. */
  ambient: 14_000,
  /** Биение сердца на логотипе. */
  heartbeat: 2_200,
  /** Пробег импульса по кардиограмме. */
  pulse: 3_400,
} as const;

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
