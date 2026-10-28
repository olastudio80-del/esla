import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Button, Gap, Pill } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { addCheckin, lastCheckin, type Checkin, type Feeling } from '@/db/checkins';
import { AMBULANCE_NUMBER, SYMPTOMS, hasAlarm, symptomById } from '@/data/symptoms';
import { useT } from '@/i18n';
import { timeOf } from '@/lib/date';
import { color, radius, semantic, space } from '@/theme/tokens';

type Step = 'intro' | 'feeling' | 'symptoms' | 'severity' | 'note' | 'done' | 'alarm';

/**
 * Помощник, который спрашивает о самочувствии и пишет ответ в мед книжку.
 *
 * Опрос сценарный, без сети: именно он выполняет саму задачу — записать
 * состояние человека в историю болезни. Живой голосовой разговор встраивается
 * сверху как способ задать те же вопросы, а не как отдельная функция, поэтому
 * без интернета возможность рассказать о самочувствии не исчезает.
 */
export default function AssistantScreen() {
  const { t, lang } = useT();
  const [step, setStep] = useState<Step>('intro');
  const [feeling, setFeeling] = useState<Feeling>('ok');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [previous, setPrevious] = useState<Checkin | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      lastCheckin()
        .then(setPrevious)
        .catch((error) => console.warn('[esla] не удалось прочитать опросы', error));
    }, []),
  );

  const symptomLabel = (id: string) => {
    const symptom = symptomById(id);
    if (!symptom) return id;
    return lang === 'ru' ? symptom.ru : symptom.uz;
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: semantic.assistantSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="spark" size={26} color={color.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="subtitle" weight="display">
            {t('assistantTitle')}
          </Txt>
          <Txt variant="caption" color={color.inkSoft}>
            {t('assistantSubtitle')}
          </Txt>
        </View>
      </View>

      {step === 'intro' ? (
        <IntroStep
          previous={previous}
          symptomLabel={symptomLabel}
          onStart={() => {
            setFeeling('ok');
            setSymptoms([]);
            setSeverity(null);
            setNote('');
            setStep('feeling');
          }}
        />
      ) : null}

      {step === 'feeling' ? (
        <Card>
          <Txt variant="subtitle" weight="display">
            {t('checkinQuestion')}
          </Txt>
          <Gap size={4} />
          <View style={{ gap: space(3) }}>
            <Button
              label={t('feelingGood')}
              icon="check"
              onPress={() => void finish('good', [], null)}
              large
            />
            <Button
              label={t('feelingOk')}
              variant="soft"
              onPress={() => {
                setFeeling('ok');
                setStep('symptoms');
              }}
              large
            />
            <Button
              label={t('feelingBad')}
              variant="soft"
              onPress={() => {
                setFeeling('bad');
                setStep('symptoms');
              }}
              large
            />
          </View>
        </Card>
      ) : null}

      {step === 'symptoms' ? (
        <Card>
          <Txt variant="subtitle" weight="display">
            {t('symptomsQuestion')}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(4) }}>
            {SYMPTOMS.map((symptom) => (
              <Pill
                key={symptom.id}
                label={lang === 'ru' ? symptom.ru : symptom.uz}
                selected={symptoms.includes(symptom.id)}
                onPress={() =>
                  setSymptoms((prev) =>
                    prev.includes(symptom.id)
                      ? prev.filter((id) => id !== symptom.id)
                      : [...prev, symptom.id],
                  )
                }
                // Тревожные состояния подкрашены иначе — их видно до нажатия.
                tint={symptom.alarm ? color.blushSoft : color.lilacSoft}
              />
            ))}
          </View>
          <Gap size={4} />
          <Button
            label={symptoms.length === 0 ? t('symptomsNone') : t('add')}
            onPress={() => {
              // Тревожный симптом прекращает опрос: дальше расспрашивать
              // человека о «выраженности» нельзя, нужно отправить к врачу.
              if (hasAlarm(symptoms)) {
                void finish(feeling, symptoms, null, true);
                return;
              }
              if (symptoms.length === 0) {
                void finish('good', [], null);
                return;
              }
              setStep('severity');
            }}
            large
          />
        </Card>
      ) : null}

      {step === 'severity' ? (
        <Card>
          <Txt variant="subtitle" weight="display">
            {t('severityQuestion')}
          </Txt>
          <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={String(value)}
                onPress={() => {
                  setSeverity(value);
                  setStep('note');
                }}
                style={{
                  flex: 1,
                  minHeight: 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: color.peachSoft,
                }}
              >
                <Txt variant="subtitle" weight="displayExtra">
                  {value}
                </Txt>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space(2) }}>
            <Txt variant="caption" color={color.inkSoft}>
              {t('severityLow')}
            </Txt>
            <Txt variant="caption" color={color.inkSoft}>
              {t('severityHigh')}
            </Txt>
          </View>
        </Card>
      ) : null}

      {step === 'note' ? (
        <Card>
          <Txt variant="subtitle" weight="display">
            {t('noteQuestion')}
          </Txt>
          <Gap size={3} />
          <Input
            placeholder={t('notePlaceholder')}
            value={note}
            onChangeText={setNote}
            multiline
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />
          <Gap size={4} />
          <Button
            label={t('save')}
            onPress={() => void finish(feeling, symptoms, severity)}
            busy={saving}
            large
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void finish(feeling, symptoms, severity)}
            style={{ alignSelf: 'center', padding: space(3) }}
          >
            <Txt variant="caption" weight="semibold" color={color.inkSoft}>
              {t('skip')}
            </Txt>
          </Pressable>
        </Card>
      ) : null}

      {step === 'done' ? (
        <Card tint={color.sageSoft}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name="check" size={28} color={color.sageDeep} strokeWidth={2.6} />
            <Txt variant="subtitle" weight="display" color={color.sageDeep}>
              {t('checkinSaved')}
            </Txt>
          </View>
          <Txt variant="body" color={color.ink} style={{ marginTop: space(3) }}>
            {t('checkinSavedHint')}
          </Txt>
          <Gap size={4} />
          <Button label={t('historyTitle')} icon="file" variant="soft" onPress={() => router.push('/history')} />
        </Card>
      ) : null}

      {step === 'alarm' ? <AlarmCard /> : null}

      {step === 'intro' ? <VoiceModeCard /> : null}

      {step !== 'intro' && step !== 'alarm' ? (
        <Txt variant="caption" color={color.inkSoft} align="center">
          {t('assistantDisclaimer')}
        </Txt>
      ) : null}
    </Screen>
  );

  async function finish(
    value: Feeling,
    selected: string[],
    severityValue: number | null,
    alarm = false,
  ) {
    if (saving) return;
    setSaving(true);
    try {
      await addCheckin({
        feeling: alarm ? 'bad' : value,
        symptoms: selected,
        severity: severityValue,
        note: note || null,
        source: 'manual',
        alarm,
      });
      setPrevious(await lastCheckin());
      setStep(alarm ? 'alarm' : 'done');
    } catch (error) {
      console.warn('[esla] не удалось записать самочувствие', error);
    } finally {
      setSaving(false);
    }
  }
}

/** Экран до начала опроса: что было в прошлый раз и одна кнопка. */
function IntroStep({
  previous,
  symptomLabel,
  onStart,
}: {
  previous: Checkin | null;
  symptomLabel: (id: string) => string;
  onStart: () => void;
}) {
  const { t } = useT();
  return (
    <>
      <Card tint={semantic.assistantSoft}>
        <Txt variant="body">{t('assistantWelcome')}</Txt>
        <Gap size={4} />
        <Button label={t('checkinStart')} icon="chat" onPress={onStart} large />
      </Card>

      <View style={{ gap: space(2) }}>
        <Caption>{t('lastCheckin')}</Caption>
        {previous ? (
          <Card>
            <Txt weight="semibold">
              {previous.created_at.slice(0, 10)} · {timeOf(previous.created_at)}
            </Txt>
            <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(2) }}>
              {previous.symptoms.length > 0
                ? previous.symptoms.map(symptomLabel).join(', ')
                : t('symptomsNone')}
            </Txt>
          </Card>
        ) : (
          <Txt variant="body" color={color.inkSoft}>
            {t('noCheckins')}
          </Txt>
        )}
      </View>
    </>
  );
}

/** Тревожное состояние: единственное действие — позвонить за помощью. */
function AlarmCard() {
  const { t } = useT();
  return (
    <Card tint={semantic.danger}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(3) }}>
        <Icon name="alert" size={28} color={color.card} strokeWidth={2.4} />
        <Txt variant="subtitle" weight="display" color={color.card} style={{ flex: 1 }}>
          {t('alarmTitle')}
        </Txt>
      </View>
      <Txt variant="body" color={color.card} style={{ marginTop: space(3), opacity: 0.95 }}>
        {t('alarmHint')}
      </Txt>
      <Gap size={4} />
      <Button
        label={t('callAmbulance', { number: AMBULANCE_NUMBER })}
        icon="call"
        variant="soft"
        onPress={() => void Linking.openURL(`tel:${AMBULANCE_NUMBER}`)}
        large
      />
    </Card>
  );
}

/**
 * Голосовой режим. Пока подключение не настроено, честно говорим об этом и
 * не прячем кнопку — иначе пользователь решит, что функции вообще нет.
 */
function VoiceModeCard() {
  const { t } = useT();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Icon name="mic" size={24} color={color.inkSoft} />
        <Txt weight="semibold" style={{ flex: 1 }}>
          {t('voiceModeOff')}
        </Txt>
      </View>
      <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
        {t('voiceModeOffHint')}
      </Txt>
    </Card>
  );
}
