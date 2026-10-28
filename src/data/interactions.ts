/**
 * Ограниченная проверка сочетаний лекарств.
 *
 * ЧТО ЭТО НЕ ЕСТЬ. Это не полная проверка лекарственных взаимодействий.
 * Полная требует лицензированной базы, которая обновляется вместе с
 * реестром и клиническими рекомендациями. Здесь — короткий список хорошо
 * задокументированных сочетаний, которые часто встречаются у пожилых
 * людей с несколькими хроническими болезнями.
 *
 * КАК ЭТО ФОРМУЛИРУЕТСЯ. Только «обсудите с врачом», никогда «нельзя
 * принимать». Врач мог назначить такое сочетание осознанно — например,
 * варфарин с амиодароном под контролем анализов. Приложение, отменяющее
 * назначение врача, опаснее приложения, которое молчит.
 *
 * ЧТО ЭТО НЕ ДЕЛАЕТ. Не блокирует сохранение лекарства и не предлагает
 * ничего отменить. Показывает предупреждение и напоминает спросить.
 *
 * Сопоставление идёт по действующему веществу (МНН) из реестра. Для
 * лекарств, вписанных вручную, проверка не работает — и это честно
 * показано в интерфейсе.
 */

export type InteractionSeverity =
  /** Обсудить при случае: обычно требует наблюдения или интервала в приёме. */
  | 'watch'
  /** Обсудить до начала приёма: риск серьёзного осложнения. */
  | 'serious';

export type InteractionRule = {
  id: string;
  /** Группы действующих веществ; правило срабатывает при совпадении обеих. */
  a: string[];
  b: string[];
  severity: InteractionSeverity;
  /** Что именно может произойти — простыми словами. */
  uz: string;
  ru: string;
};

// Группы веществ, встречающиеся в нескольких правилах.
const NSAID = [
  'диклофенак', 'ибупрофен', 'напроксен', 'кетопрофен', 'мелоксикам',
  'нимесулид', 'индометацин', 'кеторолак', 'целекоксиб', 'эторикоксиб',
];
const ACE_ARB = [
  'лизиноприл', 'эналаприл', 'каптоприл', 'рамиприл', 'периндоприл',
  'фозиноприл', 'зофеноприл',
  'лозартан', 'валсартан', 'телмисартан', 'кандесартан', 'ирбесартан',
  'олмесартан',
];
const STATIN = ['симвастатин', 'аторвастатин', 'ловастатин', 'розувастатин'];
const MACROLIDE = ['кларитромицин', 'эритромицин'];
const BETA_BLOCKER = [
  'бисопролол', 'метопролол', 'атенолол', 'карведилол', 'небиволол', 'пропранолол',
];
const RATE_CCB = ['верапамил', 'дилтиазем'];
const NITRATE = ['нитроглицерин', 'изосорбида мононитрат', 'изосорбида динитрат'];
const PDE5 = ['силденафил', 'тадалафил', 'варденафил'];
const SULFONYLUREA = ['глибенкламид', 'гликлазид', 'глимепирид'];

export const INTERACTIONS: InteractionRule[] = [
  {
    id: 'warfarin-nsaid',
    a: ['варфарин'],
    b: NSAID,
    severity: 'serious',
    uz: 'Qon ketish xavfi ortadi. Ogʻriq qoldiruvchini shifokor bilan kelishing.',
    ru: 'Повышается риск кровотечения. Обезболивающее стоит согласовать с врачом.',
  },
  {
    id: 'warfarin-aspirin',
    a: ['варфарин'],
    b: ['ацетилсалициловая кислота', 'клопидогрел'],
    severity: 'serious',
    uz: 'Ikkalasi ham qonni suyultiradi — qon ketish xavfi ortadi.',
    ru: 'Оба разжижают кровь — вместе повышают риск кровотечения.',
  },
  {
    id: 'warfarin-amiodarone',
    a: ['варфарин'],
    b: ['амиодарон'],
    severity: 'serious',
    uz: 'Amiodaron varfarin taʼsirini kuchaytiradi, tahlil nazorati kerak.',
    ru: 'Амиодарон усиливает действие варфарина — нужен контроль анализов.',
  },
  {
    id: 'ace-spironolactone',
    a: ACE_ARB,
    b: ['спиронолактон', 'эплеренон'],
    severity: 'serious',
    uz: 'Qonda kaliy koʻtarilishi mumkin — tahlil nazorati kerak.',
    ru: 'Может повыситься калий в крови — нужен контроль анализов.',
  },
  {
    id: 'ace-nsaid',
    a: ACE_ARB,
    b: NSAID,
    severity: 'watch',
    uz: 'Buyrak ishiga taʼsir qilishi va bosimni koʻtarishi mumkin.',
    ru: 'Может ухудшить работу почек и повысить давление.',
  },
  {
    id: 'statin-macrolide',
    a: STATIN,
    b: MACROLIDE,
    severity: 'serious',
    uz: 'Mushak shikastlanishi xavfi ortadi. Mushaklar ogʻrisa — shifokorga.',
    ru: 'Повышается риск повреждения мышц. При боли в мышцах — к врачу.',
  },
  {
    id: 'statin-amiodarone',
    a: ['симвастатин', 'аторвастатин'],
    b: ['амиодарон'],
    severity: 'watch',
    uz: 'Mushak ogʻrigʻi xavfi ortadi, doza kamaytirilishi mumkin.',
    ru: 'Повышается риск мышечной боли — доза может потребовать снижения.',
  },
  {
    id: 'digoxin-amiodarone',
    a: ['дигоксин'],
    b: ['амиодарон', 'верапамил'],
    severity: 'serious',
    uz: 'Digoksin miqdori oshib ketishi mumkin — koʻngil aynishi, koʻrish buzilishi.',
    ru: 'Дигоксин может накопиться — тошнота, нарушение зрения, перебои в сердце.',
  },
  {
    id: 'betablocker-ccb',
    a: BETA_BLOCKER,
    b: RATE_CCB,
    severity: 'serious',
    uz: 'Yurak urishi juda sekinlashishi mumkin.',
    ru: 'Пульс может сильно замедлиться.',
  },
  {
    id: 'nitrate-pde5',
    a: NITRATE,
    b: PDE5,
    severity: 'serious',
    uz: 'Qon bosimi keskin tushib ketishi mumkin.',
    ru: 'Давление может резко упасть.',
  },
  {
    id: 'clopidogrel-ppi',
    a: ['клопидогрел'],
    b: ['омепразол', 'эзомепразол'],
    severity: 'watch',
    uz: 'Klopidogrel taʼsiri kamayishi mumkin — boshqa dori tanlanishi mumkin.',
    ru: 'Действие клопидогрела может ослабнуть — врач может подобрать другое.',
  },
  {
    id: 'levothyroxine-minerals',
    a: ['левотироксин натрия', 'левотироксин'],
    b: ['кальция карбонат', 'железа сульфат', 'кальций', 'магния гидроксид', 'алюминия гидроксид'],
    severity: 'watch',
    uz: 'Qalqonsimon bez dorisi soʻrilmay qolishi mumkin — 4 soat oraliq kerak.',
    ru: 'Лекарство щитовидной железы хуже всасывается — нужен интервал около 4 часов.',
  },
  {
    id: 'nsaid-steroid',
    a: NSAID,
    b: ['преднизолон', 'метилпреднизолон', 'дексаметазон'],
    severity: 'serious',
    uz: 'Oshqozon yarasi va qon ketish xavfi sezilarli ortadi.',
    ru: 'Заметно повышается риск язвы желудка и кровотечения.',
  },
  {
    id: 'sulfonylurea-betablocker',
    a: SULFONYLUREA,
    b: BETA_BLOCKER,
    severity: 'watch',
    uz: 'Qand pasayganini sezmay qolish mumkin — qandni tez-tez oʻlchang.',
    ru: 'Можно не почувствовать падение сахара — измеряйте его чаще.',
  },
  {
    id: 'metformin-diuretic',
    a: ['метформин'],
    b: ['фуросемид', 'торасемид', 'гидрохлоротиазид', 'индапамид'],
    severity: 'watch',
    uz: 'Suvsizlanishda buyrakka yuk ortadi — issiqda koʻproq suv iching.',
    ru: 'При обезвоживании растёт нагрузка на почки — в жару пейте больше воды.',
  },
];

export type InteractionFinding = {
  rule: InteractionRule;
  /** Названия лекарств, из-за которых сработало правило. */
  first: string;
  second: string;
};

/** Нормализует МНН: в реестре встречаются уточнения вроде «натрия», «сульфат». */
function substances(inn: string | null): string[] {
  if (!inn) return [];
  return inn
    .toLowerCase()
    .split(/\s*\+\s*|\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Совпадает ли вещество с группой правила — по началу названия. */
function matches(list: string[], parts: string[]): boolean {
  return parts.some((part) =>
    list.some((item) => part === item || part.startsWith(item) || item.startsWith(part)),
  );
}

/**
 * Ищет известные сочетания среди принимаемых лекарств.
 *
 * Работает только по действующему веществу: у лекарств, вписанных вручную,
 * его нет, и они в проверку не попадают. Интерфейс обязан об этом сказать,
 * иначе пустой результат прочитается как «всё хорошо».
 */
export function findInteractions(
  medicines: { name: string; inn: string | null }[],
): InteractionFinding[] {
  const parsed = medicines.map((m) => ({ name: m.name, parts: substances(m.inn) }));
  const found: InteractionFinding[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      for (const rule of INTERACTIONS) {
        const direct = matches(rule.a, parsed[i].parts) && matches(rule.b, parsed[j].parts);
        const reverse = matches(rule.a, parsed[j].parts) && matches(rule.b, parsed[i].parts);
        if (!direct && !reverse) continue;

        const key = `${rule.id}:${[parsed[i].name, parsed[j].name].sort().join('|')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ rule, first: parsed[i].name, second: parsed[j].name });
      }
    }
  }

  // Серьёзные — первыми: их читают, даже если дальше не смотрят.
  return found.sort((x, y) =>
    x.rule.severity === y.rule.severity ? 0 : x.rule.severity === 'serious' ? -1 : 1,
  );
}
