/**
 * Сопоставление написаний для узбекского и русского.
 *
 * Одно и то же слово в Узбекистане пишут и латиницей, и кириллицей, и на слух:
 * «Concor» и «konkor», «Kalsiy» и «kaltsiy», «Xloropiramin» и «Хлоропирамин».
 * Распознавание речи добавляет свой разброс — оно возвращает то, что
 * услышало, а не то, что мы ждём.
 *
 * Поэтому перед сравнением обе строки приводятся к одной форме: кириллица
 * переводится в латиницу, неоднозначные сочетания сводятся к одному варианту
 * (c/k/q → k, ts → s, x/kh → h, zh → j), удвоенные согласные схлопываются.
 *
 * Это только для сравнения. Пользователю всегда показывается исходный текст.
 */

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Узбекская кириллица
  ў: 'o', қ: 'k', ғ: 'g', ҳ: 'h',
};

/** Приводит строку к форме, пригодной для сравнения. */
export function fold(value: string): string {
  let s = value
    .toLowerCase()
    // Апострофы пишут как попало: oʻ, o', o`
    .replace(/[ʻʼ‘’'`´]/g, '');

  s = s.replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? ch);

  // Порядок важен: сначала длинные сочетания, потом одиночные буквы.
  s = s
    .replace(/shch|sch/g, 'sh')
    .replace(/zh/g, 'j')
    .replace(/kh/g, 'h')
    .replace(/ph/g, 'f')
    // ch — отдельный звук; прячем, чтобы правила ниже его не разрушили.
    .replace(/ch/g, '\u0001')
    // Кириллическое «ц» уже стало «ts»; сводим к «s», как в «Kalsiy».
    .replace(/ts/g, 's')
    // Латинское «c» читается двояко: «Celecoxib» звучит как «селекоксиб»,
    // «Concor» — как «конкор». Правило позиционное, как в самой латыни:
    // перед e, i, y — «s», в остальных случаях — «k». Без этого
    // международные написания не находились бы по русским и узбекским.
    .replace(/c(?=[eiy])/g, 's')
    .replace(/[cq]/g, 'k')
    // «x» и «ks» — один звук в разных традициях записи: узбекское
    // «Xloropiramin» против русского «Хлоропирамин», международное
    // «coxib» против «коксиб».
    .replace(/x/g, 'h')
    .replace(/ks/g, 'h')
    .replace(/w/g, 'v')
    .replace(/\u0001/g, 'ch')
    // Удвоение согласных на слух не различается.
    .replace(/([bdfgjklmnprstvz])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return s;
}

/**
 * Ищет среди вариантов тот, что прозвучал в распознанной речи.
 *
 * Сравнение по вхождению, а не по равенству: человек говорит «ha, biroz
 * bosh ogʻriydi», а не ровно «bosh ogʻrigʻi». Побеждает самый длинный
 * совпавший вариант — иначе короткое слово перехватило бы ответ у точного.
 */
export function matchSpoken<T>(
  heard: string,
  options: { value: T; phrases: string[] }[],
): T | null {
  const said = fold(heard);
  if (!said) return null;

  let best: { value: T; length: number } | null = null;
  for (const option of options) {
    for (const phrase of option.phrases) {
      const needle = fold(phrase);
      if (needle.length < 2 || !said.includes(needle)) continue;
      if (!best || needle.length > best.length) {
        best = { value: option.value, length: needle.length };
      }
    }
  }
  return best ? best.value : null;
}
