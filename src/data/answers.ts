import type { Feeling } from '@/db/checkins';
import { SYMPTOMS } from '@/data/symptoms';

/**
 * Что человек реально говорит в ответ на вопрос помощника.
 *
 * Это не словарь языка, а список ожидаемых ответов: распознавание вернёт
 * фразу целиком («ha, biroz boshim ogʻriyapti»), и нам нужно найти в ней
 * знакомое слово. Сравнение идёт через fold(), поэтому писать все варианты
 * написания не нужно — достаточно одного на каждое слово.
 *
 * Если ничего не совпало, экран просто остаётся с кнопками. Это нормальный
 * исход, а не ошибка: голос здесь помогает, но ничего не решает.
 */

export const FEELING_PHRASES: { value: Feeling; phrases: string[] }[] = [
  {
    value: 'good',
    phrases: [
      // узбекский
      'yaxshi', 'yaxshiman', 'zoʻr', 'soz', 'tuzuk', 'normal', 'yomon emas',
      // русский
      'хорошо', 'нормально', 'отлично', 'хорошо себя чувствую', 'всё хорошо', 'хорошо спасибо',
    ],
  },
  {
    value: 'ok',
    phrases: [
      'oʻrtacha', 'boʻladi', 'bir xil', 'oʻzgarish yoʻq',
      'средне', 'так себе', 'более менее', 'потихоньку', 'как обычно',
    ],
  },
  {
    value: 'bad',
    phrases: [
      'yomon', 'yomonman', 'qiynalyapman', 'ogʻriyapti', 'holim yoʻq', 'battar',
      'плохо', 'плохо себя чувствую', 'хуже', 'тяжело', 'болит',
    ],
  },
];

export const YES_PHRASES = ['ha', 'ha albatta', 'bor', 'да', 'ага', 'есть', 'конечно'];
export const NO_PHRASES = ['yoq', 'yoʻq', 'нет', 'не надо', 'ничего', 'нету'];

/**
 * Для симптомов основой служат их же названия, плюс разговорные варианты:
 * человек скажет «boshim ogʻriyapti», а не «bosh ogʻrigʻi».
 */
const EXTRA: Record<string, string[]> = {
  headache: ['boshim ogʻriyapti', 'bosh ogʻriyapti', 'голова болит', 'болит голова'],
  dizziness: ['boshim aylanyapti', 'голова кружится', 'кружится голова'],
  weakness: ['holsizman', 'kuchim yoʻq', 'слабость', 'сил нет', 'устал'],
  nausea: ['koʻnglim aynidi', 'qusgim kelyapti', 'тошнит', 'тошнота'],
  stomach: ['qornim ogʻriyapti', 'живот болит', 'болит живот'],
  insomnia: ['uxlay olmadim', 'uyqum kelmadi', 'не сплю', 'не могу уснуть', 'плохо сплю'],
  swelling: ['oyogʻim shishdi', 'ноги отекли', 'отёк'],
  rash: ['toshib ketdi', 'высыпало', 'сыпь на коже'],
  palpitations: ['yuragim tez uryapti', 'сердце колотится', 'сердцебиение'],
  pressure: ['bosimim koʻtarildi', 'давление поднялось', 'высокое давление'],
  'chest-pain': ['koʻkragim ogʻriyapti', 'yuragim ogʻriyapti', 'грудь болит', 'сердце болит'],
  breathless: ['nafasim qisyapti', 'havo yetishmayapti', 'задыхаюсь', 'не хватает воздуха', 'тяжело дышать'],
  confusion: ['chalkashyapman', 'путаюсь', 'не соображаю', 'спутанность'],
  bleeding: ['qon ketyapti', 'кровь идёт', 'кровотечение'],
  speech: ['gapira olmayapman', 'не могу говорить', 'речь пропала'],
  'weak-side': ['qoʻlim kuchsiz', 'oyogʻim tortmayapti', 'рука не слушается', 'нога отнялась'],
};

export const SYMPTOM_PHRASES = SYMPTOMS.map((symptom) => ({
  value: symptom.id,
  phrases: [symptom.uz, symptom.ru, ...(EXTRA[symptom.id] ?? [])],
}));
