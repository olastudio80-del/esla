/**
 * Тексты сообщений близким.
 *
 * Один текст на два канала: в телеграм уходит заголовок и строки целиком,
 * в push — заголовок и строки, слитые в одну. Поэтому сообщение строится
 * как заголовок плюс строки, а не как готовая простыня.
 *
 * Язык. Для тревоги язык известен — его присылает приложение пациента, и
 * это разумная догадка про семью. Для сообщений от расписания приложение
 * не участвует, и там текст идёт сразу на двух языках: угадывать язык
 * близкого неоткуда, а ошибка угадывания означает непонятное сообщение в
 * единственный момент, когда человека и так тревожат.
 */

export type Lang = 'uz' | 'ru';

export type Notice = {
  title: string;
  lines: string[];
};

export function telegramText(notice: Notice): string {
  return [notice.title, ...notice.lines].join('\n');
}

export function pushBody(notice: Notice): string {
  return notice.lines.filter((line) => line.trim()).join(' ');
}

export function label(name: string | null): string {
  return name && name.trim() ? name.trim() : 'Yaqiningiz / ваш близкий';
}

export function alarmNotice(name: string, symptoms: string[], lang: Lang): Notice {
  const what = symptoms.filter((s) => s.trim()).join(', ');
  if (lang === 'ru') {
    return {
      title: `🚨 esla · ${name}`,
      lines: [what ? `${what}.` : 'Нужно проверить.', 'Пожалуйста, свяжитесь с ним.'],
    };
  }
  return {
    title: `🚨 esla · ${name}`,
    lines: [what ? `${what}.` : 'Tekshirish kerak.', 'Iltimos, u bilan bogʻlaning.'],
  };
}

export function testNotice(lang: Lang): Notice {
  return {
    title: '✅ esla',
    lines: [
      lang === 'ru'
        ? 'Проверка связи. Так будет выглядеть предупреждение.'
        : 'Aloqa tekshiruvi. Ogohlantirish shunday koʻrinadi.',
    ],
  };
}

export function silenceNotice(name: string, hours: number): Notice {
  return {
    title: `⏳ esla · ${name}`,
    lines: [
      `Telefon ${hours} soatdan beri javob bermayapti. Iltimos, qoʻngʻiroq qiling.`,
      '',
      `Телефон не выходит на связь ${hours} часов. Пожалуйста, позвоните.`,
    ],
  };
}

/** Сколько букв списка лекарств влезает в сообщение. */
const MEDICINES_LIMIT = 100;

/**
 * Неотмеченный приём.
 *
 * Формулировка важнее механики: мы знаем только то, что кнопку не нажали,
 * и сообщение обязано говорить именно это. «Не принял лекарство» было бы
 * обвинением, которого мы проверить не можем, и оно же било бы по
 * отношениям в семье, ради которых всё это и делается.
 */
export function missedNotice(name: string, medicines: string): Notice {
  const what =
    medicines.length > MEDICINES_LIMIT ? `${medicines.slice(0, MEDICINES_LIMIT)}…` : medicines;
  return {
    title: `💊 esla · ${name}`,
    lines: [
      `${what} qabulini belgilamadi. Dorini ichgan boʻlishi ham mumkin — qoʻngʻiroq qilib soʻrang.`,
      '',
      `Не отметил приём — ${what}. Возможно, лекарство принято, а кнопка не нажата — позвоните и спросите.`,
    ],
  };
}
