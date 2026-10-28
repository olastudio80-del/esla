import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Gap, IconButton } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { symptomById } from '@/data/symptoms';
import {
  collectMedicalCard,
  shareMedicalCard,
  type MedicalCardData,
} from '@/features/medicalCard';
import { useT } from '@/i18n';
import { timeOf } from '@/lib/date';
import { useLabels } from '@/lib/labels';
import { usePrefs } from '@/store/prefs';
import { color, radius, semantic, space } from '@/theme/tokens';
import type { Meal } from '@/db/types';

/**
 * Медкарта на экране.
 *
 * Её показывают врачу, который видит человека впервые — возможно, рядом
 * со скорой и без времени читать. Поэтому порядок от самого важного:
 * аллергия выше диагнозов, диагнозы выше лекарств, и всё крупно.
 *
 * Показ с экрана — основной способ. Отправка в PDF осталась кнопкой
 * внизу: она нужна, когда врача рядом нет, а карту надо переслать.
 */
export default function MedicalCardScreen() {
  const { t, lang } = useT();
  const { prefs } = usePrefs();
  const labels = useLabels();
  const [data, setData] = useState<MedicalCardData | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let alive = true;
    collectMedicalCard(prefs.patientName, prefs.birthYear)
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((error) => console.warn('[esla] медкарта не собралась', error));
    return () => {
      alive = false;
    };
  }, [prefs.patientName, prefs.birthYear]);

  const empty =
    data !== null &&
    data.allergies.length === 0 &&
    data.diagnoses.length === 0 &&
    data.medications.length === 0;

  return (
    <Screen
      footer={
        <Button
          label={t('shareAsPdf')}
          icon="share"
          variant="soft"
          busy={sharing}
          onPress={async () => {
            setSharing(true);
            try {
              await shareMedicalCard({
                lang,
                patientName: prefs.patientName,
                birthYear: prefs.birthYear,
              });
            } catch (error) {
              console.warn('[esla] не удалось отправить медкарту', error);
              Alert.alert(t('retry'));
            } finally {
              setSharing(false);
            }
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <IconButton name="left" label={t('back')} onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Txt variant="title" weight="display">
            {t('medicalCardTitle')}
          </Txt>
          <Txt variant="caption" color={color.inkSoft}>
            {t('forDoctors')}
          </Txt>
        </View>
      </View>

      {!data ? (
        <Txt color={color.inkSoft}>{t('loading')}</Txt>
      ) : empty ? (
        <Card>
          <Txt variant="subtitle" weight="display">
            {t('cardEmpty')}
          </Txt>
          <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(2) }}>
            {t('cardEmptyHint')}
          </Txt>
        </Card>
      ) : (
        <>
          <Card>
            <Txt variant="headline" weight="displayExtra">
              {data.patientName || '—'}
            </Txt>
            {data.age != null ? (
              <Txt variant="bodyLarge" color={color.inkSoft}>
                {t('years', { n: data.age })}
              </Txt>
            ) : null}
          </Card>

          {/* Аллергия выше всего: именно её врач должен увидеть первой. */}
          <Section title={t('allergies')} tint={data.allergies.length > 0 ? semantic.danger : undefined}>
            {data.allergies.length > 0 ? (
              data.allergies.map((item) => (
                <Txt key={item} variant="bodyLarge" weight="bold" color={color.card}>
                  {item}
                </Txt>
              ))
            ) : (
              <Txt variant="body" color={color.inkSoft}>
                {t('noAllergies')}
              </Txt>
            )}
          </Section>

          <Section title={t('diagnoses')}>
            {data.diagnoses.length > 0 ? (
              data.diagnoses.map((item) => (
                <Txt key={item} variant="bodyLarge" weight="semibold">
                  {item}
                </Txt>
              ))
            ) : (
              <Txt variant="body" color={color.inkSoft}>
                {t('notSet')}
              </Txt>
            )}
          </Section>

          <Section title={t('medicinesTitle')}>
            {data.medications.length > 0 ? (
              data.medications.map((med) => (
                <View key={`${med.name}-${med.dosage ?? ''}`} style={{ gap: space(1) }}>
                  <Txt variant="bodyLarge" weight="bold">
                    {med.name}
                    {med.dosage ? ` ${med.dosage}` : ''}
                  </Txt>
                  <Txt variant="body" color={color.inkSoft}>
                    {[med.times.join(', '), labels.meal(med.meal as Meal)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Txt>
                </View>
              ))
            ) : (
              <Txt variant="body" color={color.inkSoft}>
                {t('noMedicines')}
              </Txt>
            )}
          </Section>

          {data.alarms.length > 0 ? (
            <Section title={t('alarmTitle')} tint={color.peachSoft}>
              {data.alarms.slice(0, 5).map((alarm) => (
                <Txt key={alarm.id} variant="body">
                  {alarm.created_at.slice(0, 10)} ·{' '}
                  {alarm.symptoms
                    .map((id) => {
                      const symptom = symptomById(id);
                      return symptom ? (lang === 'ru' ? symptom.ru : symptom.uz) : id;
                    })
                    .join(', ')}
                </Txt>
              ))}
            </Section>
          ) : null}

          {data.checkins.length > 0 ? (
            <Section title={t('checkinTitle')}>
              {data.checkins.slice(0, 5).map((checkin) => (
                <View key={checkin.id} style={{ gap: space(1) }}>
                  <Txt weight="semibold">
                    {checkin.created_at.slice(0, 10)} · {timeOf(checkin.created_at)}
                  </Txt>
                  <Txt variant="body" color={color.inkSoft}>
                    {checkin.symptoms.length > 0
                      ? checkin.symptoms
                          .map((id) => {
                            const symptom = symptomById(id);
                            return symptom ? (lang === 'ru' ? symptom.ru : symptom.uz) : id;
                          })
                          .join(', ')
                      : t('symptomsNone')}
                    {checkin.severity ? ` · ${checkin.severity}/5` : ''}
                  </Txt>
                </View>
              ))}
            </Section>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: space(3),
              padding: space(4),
              borderRadius: radius.lg,
              backgroundColor: color.app,
            }}
          >
            <Icon name="stethoscope" size={20} color={color.inkSoft} />
            <Txt variant="caption" color={color.inkSoft} style={{ flex: 1 }}>
              {t('assistantDisclaimer')}
            </Txt>
          </View>
          <Gap size={2} />
        </>
      )}
    </Screen>
  );
}

function Section({
  title,
  tint,
  children,
}: {
  title: string;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space(2) }}>
      <Caption>{title}</Caption>
      <Card tint={tint ?? color.card}>
        <View style={{ gap: space(3) }}>{children}</View>
      </Card>
    </View>
  );
}
