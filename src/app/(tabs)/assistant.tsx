import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { VoiceBar } from '@/components/VoiceBar';
import { Button, Gap, Pill } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { addCheckin, lastCheckin, type Checkin, type Feeling } from '@/db/checkins';
import { FEELING_PHRASES, SYMPTOM_PHRASES } from '@/data/answers';
import { AMBULANCE_NUMBER, SYMPTOMS, hasAlarm, symptomById } from '@/data/symptoms';
import { pushPatientState } from '@/features/cloud/sync';
import { downloadOfflineModel } from '@/features/voice';
import { useVoiceAsk } from '@/hooks/useVoiceAsk';
import { useT } from '@/i18n';
import { timeOf } from '@/lib/date';
import { usePrefs } from '@/store/prefs';
import { color, radius, semantic, space } from '@/theme/tokens';

type Step = 'intro' | 'feeling' | 'symptoms' | 'severity' | 'note' | 'done' | 'alarm';

/**
 * Помощник, который спрашивает о самочувствии и пишет ответ в мед книжку.
 *
 * Вопросы озвучиваются, ответ распознаётся на самом телефоне — без интернета,
 * без отправки голоса наружу и без языковой модели: на закрытый вопрос
 * достаточно узнать знакомое слово, а свободный рассказ записывается
 * дословно, потому что интерпретировать его мы и не собираемся.
 *
 * Кнопки на экране есть всегда. Распознавание может не понять, язык может
 * быть не установлен, микрофон может быть занят — ни один из этих случаев
 * не должен лишить человека возможности сказать, что ему плохо.
 */
export default function AssistantScreen() {
  const { t, lang } = useT();
  const voice = useVoiceAsk();

  const [step, setStep] = useState<Step>('intro');
  const [feeling, setFeeling] = useState<Feeling>('ok');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [heard, setHeard] = useState<string | null>(null);
  const [previous, setPrevious] = useState<Checkin | null>(null);
  const [saving, setSaving] = useState(false);

  // Чтобы вопрос не задавался заново при каждой перерисовке шага.
  const askedFor = useRef<Step | null>(null);

  useFocusEffect(
    useCallback(() => {
      lastCheckin()
        .then(setPrevious)
        .catch((error) => console.warn('[esla] не удалось прочитать опросы', error));
      return () => voice.cancel();
    }, [voice]),
  );

  const symptomLabel = useCallback(
    (id: string) => {
      const symptom = symptomById(id);
      if (!symptom) return id;
      return lang === 'ru' ? symptom.ru : symptom.uz;
    },
    [lang],
  );

  // Голосовой вопрос на тех шагах, где есть что спросить.
  useEffect(() => {
    if (!voice.enabled) return;
    if (step !== 'feeling' && step !== 'symptoms') return;
    if (askedFor.current === step) return;
    askedFor.current = step;

    let alive = true;
    (async () => {
      if (step === 'feeling') {
        const answer = await voice.ask(t('checkinQuestion'), FEELING_PHRASES);
        if (!alive) return;
        setHeard(answer.heard);
        if (answer.value === 'good') {
          void finish('good', [], null);
        } else if (answer.value) {
          setFeeling(answer.value);
          setStep('symptoms');
        }
        return;
      }

      const answer = await voice.ask(t('symptomsQuestion'), SYMPTOM_PHRASES);
      if (!alive) return;
      setHeard(answer.heard);
      if (answer.value) toggleSymptom(answer.value);
    })();

    return () => {
      alive = false;
    };
    // finish и toggleSymptom описаны ниже и стабильны в пределах шага.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, voice.enabled]);

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

      {voice.enabled && step !== 'intro' && step !== 'done' && step !== 'alarm' ? (
        <VoiceBar
          state={voice.state}
          partial={voice.partial}
          offline={voice.capabilities.offlineReady}
          onPress={() => void repeatQuestion()}
        />
      ) : null}

      {heard && step !== 'done' ? (
        <Txt variant="caption" color={color.inkSoft}>
          {t('voiceHeard', { text: heard })}
        </Txt>
      ) : null}

      {step === 'intro' ? (
        <>
          <Card tint={semantic.assistantSoft}>
            <Txt variant="body">{t('assistantWelcome')}</Txt>
            <Gap size={4} />
            <Button label={t('checkinStart')} icon="chat" onPress={start} large />
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

          <VoiceStatusCard />
        </>
      ) : null}

      {step === 'feeling' ? (
        <Card>
          <Txt variant="subtitle" weight="display">
            {t('checkinQuestion')}
          </Txt>
          <Gap size={4} />
          <View style={{ gap: space(3) }}>
            <Button label={t('feelingGood')} icon="check" onPress={() => void finish('good', [], null)} large />
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
                onPress={() => toggleSymptom(symptom.id)}
                // Тревожные состояния подкрашены иначе — их видно до нажатия.
                tint={symptom.alarm ? color.blushSoft : color.lilacSoft}
              />
            ))}
          </View>
          <Gap size={4} />
          <Button label={symptoms.length === 0 ? t('symptomsNone') : t('add')} onPress={afterSymptoms} large />
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
          {voice.enabled ? (
            <>
              <Gap size={2} />
              {/* Свободный рассказ записывается дословно: понимать его не нужно. */}
              <Button
                label={t('voiceTap')}
                icon="mic"
                variant="soft"
                onPress={() => void dictateNote()}
                busy={voice.state === 'listening'}
              />
            </>
          ) : null}
          <Gap size={4} />
          <Button label={t('save')} onPress={() => void finish(feeling, symptoms, severity)} busy={saving} large />
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

      {step !== 'intro' && step !== 'alarm' ? (
        <Txt variant="caption" color={color.inkSoft} align="center">
          {t('assistantDisclaimer')}
        </Txt>
      ) : null}
    </Screen>
  );

  function start() {
    setFeeling('ok');
    setSymptoms([]);
    setSeverity(null);
    setNote('');
    setHeard(null);
    askedFor.current = null;
    setStep('feeling');
  }

  function toggleSymptom(id: string) {
    setSymptoms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function afterSymptoms() {
    // Тревожный симптом прекращает опрос: расспрашивать дальше о
    // «выраженности» нельзя, человека нужно направить к врачу.
    if (hasAlarm(symptoms)) {
      void finish(feeling, symptoms, null, true);
      return;
    }
    if (symptoms.length === 0) {
      void finish('good', [], null);
      return;
    }
    setStep('severity');
  }

  /** Повторить вопрос голосом — человек мог не расслышать. */
  async function repeatQuestion() {
    if (voice.state !== 'idle') {
      voice.cancel();
      return;
    }
    askedFor.current = null;
    if (step === 'feeling') {
      const answer = await voice.ask(t('checkinQuestion'), FEELING_PHRASES);
      setHeard(answer.heard);
      if (answer.value === 'good') void finish('good', [], null);
      else if (answer.value) {
        setFeeling(answer.value);
        setStep('symptoms');
      }
    } else if (step === 'symptoms') {
      const answer = await voice.ask(t('symptomsQuestion'), SYMPTOM_PHRASES);
      setHeard(answer.heard);
      if (answer.value) toggleSymptom(answer.value);
    } else {
      await dictateNote();
    }
  }

  async function dictateNote() {
    const text = await voice.dictate();
    if (text) setNote((prev) => (prev ? `${prev} ${text}` : text));
  }

  async function finish(
    value: Feeling,
    selected: string[],
    severityValue: number | null,
    alarm = false,
  ) {
    if (saving) return;
    setSaving(true);
    voice.cancel();
    try {
      await addCheckin({
        feeling: alarm ? 'bad' : value,
        symptoms: selected,
        severity: severityValue,
        note: note || null,
        source: voice.enabled ? 'assistant' : 'manual',
        alarm,
      });
      setPrevious(await lastCheckin());
      setStep(alarm ? 'alarm' : 'done');
      // Тревожная запись уходит родственнику, обычная остаётся на телефоне.
      if (alarm) void pushPatientState(null);
    } catch (error) {
      console.warn('[esla] не удалось записать самочувствие', error);
    } finally {
      setSaving(false);
    }
  }
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

/** Что телефон умеет с голосом — и как сделать, чтобы работал без интернета. */
function VoiceStatusCard() {
  const { t } = useT();
  const { prefs } = usePrefs();
  const voice = useVoiceAsk();
  const [requested, setRequested] = useState(false);

  if (!voice.capabilities.recognition || !voice.capabilities.localeSupported) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <Icon name="mic" size={22} color={color.inkSoft} />
          <Txt weight="semibold" style={{ flex: 1 }}>
            {t('voiceNotSupported')}
          </Txt>
        </View>
        <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
          {t('voiceNotSupportedHint')}
        </Txt>
      </Card>
    );
  }

  if (voice.capabilities.offlineReady) {
    return (
      <Card tint={color.sageSoft}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <Icon name="mic" size={22} color={color.sageDeep} />
          <Txt weight="semibold" color={color.sageDeep} style={{ flex: 1 }}>
            {t('voiceOfflineReady')}
          </Txt>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Icon name="mic" size={22} color={color.inkSoft} />
        <Txt weight="semibold" style={{ flex: 1 }}>
          {t('voiceOnlineOnly')}
        </Txt>
      </View>
      <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
        {t('voiceDownloadHint')}
      </Txt>
      <Gap size={3} />
      <Button
        label={t('voiceDownloadModel')}
        variant="soft"
        disabled={requested}
        onPress={() => {
          setRequested(true);
          void downloadOfflineModel(prefs.lang);
        }}
      />
    </Card>
  );
}
