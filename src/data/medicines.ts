import { fold } from '@/lib/text';

/**
 * Справочник лекарственных средств, разрешённых в Узбекистане.
 *
 * Источник — выгрузка государственного реестра (референтные цены),
 * 8 904 позиции: торговое название, действующее вещество, форма выпуска
 * и зарегистрированные дозировки. Цены, производители и регистрационные
 * номера в приложение не переносятся: оно помогает правильно записать
 * назначенное врачом, а не выбирать лекарство и тем более не торговать им.
 *
 * Данные лежат в registry.json отдельно от кода и подгружаются при первом
 * поиске, а не при запуске: файл весит около 700 КБ, и разбирать его ради
 * экрана с напоминанием о таблетке незачем.
 *
 * Чтобы обновить справочник новой выгрузкой — см. scripts/README в репозитории.
 */

export type MedForm =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'injection'
  | 'drops'
  | 'ointment'
  | 'powder'
  | 'spray'
  | 'inhaler'
  | 'patch'
  | 'suppository'
  | 'suspension'
  | 'solution'
  | 'other';

export type CatalogEntry = {
  /** Торговое название, как в реестре. */
  name: string;
  /** Действующее вещество (МНН). */
  inn: string;
  form: MedForm;
  /** Зарегистрированные дозировки. */
  strengths: string[];
};

export type CatalogHit = { entry: CatalogEntry };

/** Формат файла: повторяющиеся значения вынесены в таблицы, строки ссылаются номерами. */
type Registry = {
  inns: string[];
  /** Те же МНН, свёрнутые для сравнения. */
  foldedInns: string[];
  forms: string[];
  strengths: string[];
  /** [название, номер МНН, номер формы, номера дозировок, свёрнутое название] */
  rows: [string, number, number, number[], string][];
};

let registry: Registry | null = null;

function load(): Registry {
  // Загрузка при первом поиске: до экрана «Dori qoʻshish» эти данные не нужны.
  registry ??= require('./registry.json') as Registry;
  return registry;
}

function toEntry(data: Registry, index: number): CatalogEntry {
  const [name, innIndex, formIndex, doseIndexes] = data.rows[index];
  return {
    name,
    inn: data.inns[innIndex] ?? '',
    form: (data.forms[formIndex] ?? 'other') as MedForm,
    strengths: doseIndexes.map((i) => data.strengths[i]).filter(Boolean),
  };
}

/**
 * Поиск по справочнику.
 *
 * Порядок выдачи важнее полноты: человек переписывает рецепт и ищет
 * конкретную коробку. Поэтому совпадение с начала торгового названия
 * идёт выше совпадения по действующему веществу — иначе набрав
 * «метформин», он получил бы сто четырнадцать чужих марок вместо
 * препарата с таким названием.
 */
export function searchCatalog(query: string, limit = 6): CatalogHit[] {
  const q = fold(query);
  if (q.length < 2) return [];

  const data = load();
  const found: { index: number; rank: number; length: number }[] = [];

  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const name = row[4];
    const inn = data.foldedInns[row[1]] ?? '';

    let rank: number;
    if (name === q) rank = 0;
    // Препарат, названный по действующему веществу («Метформин»), человек
    // узнаёт сразу, а марку вроде «МЕТФОКСИН» — нет. Поэтому при равном
    // совпадении с начала такие идут первыми.
    else if (name.startsWith(q) && name === inn) rank = 1;
    else if (name.startsWith(q)) rank = 2;
    else if (inn.startsWith(q)) rank = 3;
    else if (name.includes(q)) rank = 4;
    else if (inn.includes(q)) rank = 5;
    else continue;

    found.push({ index: i, rank, length: name.length });
    // Ранний выход: точных совпадений с начала названия обычно хватает,
    // а проход по всем девяти тысячам строк на каждую букву не нужен.
    if (found.length > 400) break;
  }

  found.sort((a, b) => a.rank - b.rank || a.length - b.length);
  return found.slice(0, limit).map(({ index }) => ({ entry: toEntry(data, index) }));
}

/** Сколько всего позиций в справочнике — для экрана «о приложении». */
export function catalogSize(): number {
  return load().rows.length;
}
