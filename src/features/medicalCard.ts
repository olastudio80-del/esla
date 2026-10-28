import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { checkinsForMedicalCard } from '@/db/checkins';
import { listConditions } from '@/db/documents';
import { listMedications } from '@/db/medications';
import { translate } from '@/i18n';
import { dateKey, hhmm, timeOf } from '@/lib/date';
import type { Lang } from '@/store/prefs';
import { symptomById } from '@/data/symptoms';

/**
 * Экстренная медкарта из презентации: «шифокорлар учун тиббий карта бир
 * босишда тайёрланади».
 *
 * Это документ для врача, который видит человека первый раз, возможно без
 * сознания. Поэтому порядок разделов — от самого важного: аллергия и
 * тревожные состояния выше, чем список анализов. Ничего не придумываем:
 * в карту попадает только то, что пользователь сам внёс в приложение.
 */

/** Экранирование: названия лекарств и заметки пользователь вводит сам. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type MedicalCardData = {
  patientName: string;
  age: number | null;
  allergies: string[];
  diagnoses: string[];
  medications: {
    name: string;
    dosage: string | null;
    times: string[];
    meal: string;
  }[];
  checkins: Awaited<ReturnType<typeof checkinsForMedicalCard>>;
  alarms: Awaited<ReturnType<typeof checkinsForMedicalCard>>;
};

/**
 * Собирает медкарту из того, что человек внёс сам.
 *
 * Одни и те же данные идут и на экран, и в PDF: иначе врач на экране и
 * врач в распечатке видели бы разное.
 */
export async function collectMedicalCard(
  patientName: string,
  birthYear: number | null,
): Promise<MedicalCardData> {
  const [meds, diagnoses, allergies, checkins] = await Promise.all([
    listMedications(),
    listConditions('diagnosis'),
    listConditions('allergy'),
    checkinsForMedicalCard(30),
  ]);

  return {
    patientName,
    age: birthYear ? new Date().getFullYear() - birthYear : null,
    allergies: allergies.map((a) => a.label),
    diagnoses: diagnoses.map((d) => d.label),
    medications: meds.map((med) => ({
      name: med.name,
      dosage: med.dosage,
      times: med.times.map((x) => hhmm(x.hour, x.minute)),
      meal: med.meal,
    })),
    checkins,
    alarms: checkins.filter((c) => c.alarm),
  };
}

export type MedicalCardInput = {
  lang: Lang;
  patientName: string;
  birthYear: number | null;
  emergencyContact?: string | null;
};

export async function buildMedicalCardHtml(input: MedicalCardInput): Promise<string> {
  const { lang } = input;
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate(lang, key, params);

  const [meds, diagnoses, allergies, checkins] = await Promise.all([
    listMedications(),
    listConditions('diagnosis'),
    listConditions('allergy'),
    checkinsForMedicalCard(30),
  ]);

  const age = input.birthYear ? new Date().getFullYear() - input.birthYear : null;
  const alarms = checkins.filter((c) => c.alarm);

  const medRows = meds
    .map((med) => {
      const times = med.times.map((x) => hhmm(x.hour, x.minute)).join(', ') || '—';
      const meal =
        med.meal === 'after'
          ? t('afterMeal')
          : med.meal === 'before'
            ? t('beforeMeal')
            : med.meal === 'with'
              ? t('withMeal')
              : '';
      return `<tr>
        <td><b>${esc(med.name)}</b></td>
        <td>${esc(med.dosage ?? '—')}</td>
        <td>${esc(times)}</td>
        <td>${esc(meal)}</td>
      </tr>`;
    })
    .join('');

  const checkinRows = checkins
    .slice(0, 12)
    .map((c) => {
      const symptoms = c.symptoms
        .map((id) => {
          const s = symptomById(id);
          return s ? (lang === 'ru' ? s.ru : s.uz) : id;
        })
        .join(', ');
      const feeling =
        c.feeling === 'good' ? t('feelingGood') : c.feeling === 'ok' ? t('feelingOk') : t('feelingBad');
      return `<tr${c.alarm ? ' class="alarm"' : ''}>
        <td>${esc(c.created_at.slice(0, 10))} ${esc(timeOf(c.created_at))}</td>
        <td>${esc(feeling)}</td>
        <td>${esc(symptoms || '—')}${c.severity ? ` (${c.severity}/5)` : ''}</td>
        <td>${esc(c.note ?? '')}</td>
      </tr>`;
    })
    .join('');

  const list = (items: { label: string }[], empty: string) =>
    items.length > 0
      ? `<ul>${items.map((i) => `<li>${esc(i.label)}</li>`).join('')}</ul>`
      : `<p class="muted">${esc(empty)}</p>`;

  // Стили встроенные и простые: документ идёт в печать и в мессенджер врачу.
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t('emergencyTitle'))} — ${esc(input.patientName || 'esla')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
         color: #3B2D43; margin: 0; padding: 28px; font-size: 14px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .08em;
       color: #6E5E76; margin: 24px 0 8px; border-bottom: 1px solid #E4D4C7; padding-bottom: 6px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .brand { font-weight: 900; font-size: 20px; color: #5A2050; }
  .muted { color: #6E5E76; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #ECDDCF; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #6E5E76; }
  ul { margin: 4px 0; padding-left: 20px; }
  .warn { background: #F8D6D4; border-radius: 10px; padding: 12px 14px; margin-top: 8px; }
  tr.alarm td { background: #F8D6D4; }
  footer { margin-top: 28px; font-size: 12px; color: #6E5E76; border-top: 1px solid #E4D4C7; padding-top: 10px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>${esc(input.patientName || '—')}</h1>
      <p class="muted">${age != null ? esc(t('years', { n: age })) : ''}</p>
    </div>
    <div class="brand">esla</div>
  </div>

  <h2>${esc(t('allergies'))}</h2>
  ${list(allergies, t('noAllergies'))}

  <h2>${esc(t('diagnoses'))}</h2>
  ${list(diagnoses, t('notSet'))}

  <h2>${esc(t('medicinesTitle'))}</h2>
  ${
    meds.length > 0
      ? `<table><thead><tr>
           <th>${esc(t('medicineName'))}</th>
           <th>${esc(t('dosage'))}</th>
           <th>${esc(t('intakeTime'))}</th>
           <th>${esc(t('mealRelation'))}</th>
         </tr></thead><tbody>${medRows}</tbody></table>`
      : `<p class="muted">${esc(t('noMedicines'))}</p>`
  }

  ${
    alarms.length > 0
      ? `<div class="warn"><b>${esc(t('alarmTitle'))}</b><br>${esc(
          alarms
            .map((a) => `${a.created_at.slice(0, 10)}: ${a.symptoms.map((id) => {
              const s = symptomById(id);
              return s ? (lang === 'ru' ? s.ru : s.uz) : id;
            }).join(', ')}`)
            .join(' · '),
        )}</div>`
      : ''
  }

  <h2>${esc(t('checkinTitle'))}</h2>
  ${
    checkins.length > 0
      ? `<table><thead><tr>
           <th>${esc(t('lastCheckin'))}</th>
           <th>${esc(t('checkinTitle'))}</th>
           <th>${esc(t('symptomsQuestion'))}</th>
           <th>${esc(t('noteQuestion'))}</th>
         </tr></thead><tbody>${checkinRows}</tbody></table>`
      : `<p class="muted">${esc(t('noCheckins'))}</p>`
  }

  ${
    input.emergencyContact
      ? `<h2>${esc(t('emergencyContact'))}</h2><p>${esc(input.emergencyContact)}</p>`
      : ''
  }

  <footer>
    ${esc(t('appTagline'))} · esla · ${esc(dateKey())}<br>
    ${esc(t('assistantDisclaimer'))}
  </footer>
</body>
</html>`;
}

/** Делает PDF и открывает системный диалог «поделиться». */
export async function shareMedicalCard(input: MedicalCardInput): Promise<void> {
  const html = await buildMedicalCardHtml(input);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: translate(input.lang, 'cardShare'),
      UTI: 'com.adobe.pdf',
    });
  }
}
