import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { Button, Gap, Pill } from '@/components/ui/Button';
import { Caption, Card, SectionTitle } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { dayProgress, type DayProgress } from '@/db/doses';
import { symptomById } from '@/data/symptoms';
import { getAllPhones, setPhone } from '@/features/cloud/contacts';
import { useFamily, type PatientView } from '@/hooks/useFamily';
import { useHealth } from '@/hooks/useHealth';
import { useT } from '@/i18n';
import { localISO, timeOf } from '@/lib/date';
import { formatCount, useAgo, useDuration } from '@/lib/format';
import { color, radius, semantic, space } from '@/theme/tokens';

/**
 * Раздел «Ota-onam» из презентации.
 *
 * У экрана две стороны: на телефоне родителя он показывает код приглашения,
 * на телефоне ребёнка — состояние родителей. Какая сторона нужна, человек
 * выбирает сам; переключатель остаётся на виду, потому что ошибиться
 * при первом запуске легко.
 */
export default function FamilyScreen() {
  const { t } = useT();
  const family = useFamily();

  return (
    <Screen>
      <SectionTitle title={t('familyTitle')} />

      <View style={{ gap: space(2) }}>
        <Caption>{t('familyRoleQuestion')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Pill
            label={t('roleIAmPatient')}
            selected={family.role === 'patient'}
            onPress={() => family.setRole('patient')}
            tint={color.blushSoft}
          />
          <Pill
            label={t('roleIAmRelative')}
            selected={family.role === 'relative'}
            onPress={() => family.setRole('relative')}
            tint={color.blushSoft}
          />
        </View>
      </View>

      {!family.configured ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name="users" size={24} color={color.inkSoft} />
            <Txt weight="semibold" style={{ flex: 1 }}>
              {t('cloudOff')}
            </Txt>
          </View>
          <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
            {t('cloudOffHint')}
          </Txt>
        </Card>
      ) : family.role === 'patient' ? (
        <PatientSide family={family} />
      ) : (
        <RelativeSide family={family} />
      )}
    </Screen>
  );
}

/** Сторона родителя: код для детей и собственные показатели. */
function PatientSide({ family }: { family: ReturnType<typeof useFamily> }) {
  const { t } = useT();

  return (
    <>
      <Card tint={color.blushSoft}>
        <Txt variant="bodyLarge" weight="display">
          {t('shareCodeTitle')}
        </Txt>
        <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
          {t('shareCodeHint')}
        </Txt>

        {family.invite ? (
          <>
            <Txt
              variant="hero"
              weight="displayExtra"
              align="center"
              style={{ marginTop: space(4), letterSpacing: 6 }}
            >
              {family.invite.code}
            </Txt>
            <Txt variant="caption" color={color.inkSoft} align="center" style={{ marginTop: space(2) }}>
              {t('codeExpires', { time: timeOf(localISO(new Date(family.invite.expiresAt))) })}
            </Txt>
          </>
        ) : null}

        <Gap size={4} />
        <Button
          label={family.invite ? t('newCode') : t('inviteCode')}
          icon="share"
          onPress={() => void family.createInvite()}
          busy={family.busy}
          large
        />
      </Card>

      <OwnVitals />
    </>
  );
}

/** Сторона ребёнка: список родителей и ввод кода. */
function RelativeSide({ family }: { family: ReturnType<typeof useFamily> }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phones, setPhones] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      getAllPhones().then(setPhones).catch(() => {});
    }, []),
  );

  return (
    <>
      {family.views.length === 0 && !family.loading ? (
        <Card>
          <Txt variant="subtitle" weight="display">
            {t('familyEmpty')}
          </Txt>
          <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(2) }}>
            {t('familyEmptyHint')}
          </Txt>
        </Card>
      ) : null}

      {family.views.map((view) => (
        <PatientCard
          key={view.patient.id}
          view={view}
          phone={phones[view.patient.id] ?? null}
          onSavePhone={async (value) => {
            await setPhone(view.patient.id, value);
            setPhones(await getAllPhones());
          }}
          onRemove={() => {
            Alert.alert(
              t('unlinkConfirm', { name: view.patient.name ?? t('roleRelative') }),
              undefined,
              [
                { text: t('cancel'), style: 'cancel' },
                {
                  text: t('unlink'),
                  style: 'destructive',
                  onPress: () => void family.removePatient(view.patient.id),
                },
              ],
            );
          }}
        />
      ))}

      <Card tint={color.app}>
        <Input
          label={t('enterCodeTitle')}
          value={code}
          onChangeText={(value) => {
            // Код диктуют вслух: регистр и пробелы не должны мешать.
            setCode(value.toUpperCase().replace(/\s/g, ''));
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC123"
          style={{ letterSpacing: 4 }}
        />
        {error ? (
          <Txt variant="caption" color={color.roseText} style={{ marginTop: space(2) }}>
            {error}
          </Txt>
        ) : null}
        <Gap size={3} />
        <Button
          label={t('addRelative')}
          icon="plus"
          onPress={async () => {
            const result = await family.addPatient(code, null);
            if (result.ok) {
              setCode('');
              setError(null);
            } else {
              setError(t('codeWrong'));
            }
          }}
          disabled={code.length < 6}
          busy={family.busy}
          large
        />
      </Card>
    </>
  );
}

/** Карточка одного родителя: тревога, показатели, приём лекарств. */
function PatientCard({
  view,
  phone,
  onSavePhone,
  onRemove,
}: {
  view: PatientView;
  phone: string | null;
  onSavePhone: (value: string) => Promise<void>;
  onRemove: () => void;
}) {
  const { t, lang } = useT();
  const ago = useAgo();
  const duration = useDuration();
  const [editingPhone, setEditingPhone] = useState(false);
  const [draft, setDraft] = useState(phone ?? '');

  const name = view.patient.name ?? t('roleRelative');
  const today = new Date().toISOString().slice(0, 10);
  const todayDoses = view.doses.filter((dose) => dose.plannedAt.slice(0, 10) === today);
  const taken = todayDoses.filter((dose) => dose.status === 'taken').length;
  const missed = todayDoses.filter((dose) => dose.status === 'missed');
  const unseenAlarm = view.alarms.find((alarm) => alarm.seenAt === null);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: color.peach,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="users" size={22} color={color.ink} />
        </View>
        <Txt variant="bodyLarge" weight="bold" style={{ flex: 1 }}>
          {name}
        </Txt>
      </View>

      {unseenAlarm ? (
        <View
          style={{
            marginTop: space(4),
            padding: space(4),
            borderRadius: radius.lg,
            backgroundColor: semantic.danger,
            gap: space(2),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(2) }}>
            <Icon name="alert" size={22} color={color.card} strokeWidth={2.4} />
            <Txt weight="bold" color={color.card} style={{ flex: 1 }}>
              {t('alarmFromPatient', { name })}
            </Txt>
          </View>
          <Txt variant="caption" color={color.card}>
            {unseenAlarm.symptoms
              .map((id) => {
                const symptom = symptomById(id);
                return symptom ? (lang === 'ru' ? symptom.ru : symptom.uz) : id;
              })
              .join(', ')}
          </Txt>
        </View>
      ) : null}

      {missed.length > 0 ? (
        <View
          style={{
            marginTop: space(4),
            padding: space(4),
            borderRadius: radius.lg,
            backgroundColor: color.peachSoft,
          }}
        >
          <Txt weight="semibold">{t('missedToday', { n: missed.length })}</Txt>
          {missed.map((dose) => (
            <Txt key={dose.localId} variant="caption" color={color.inkSoft} style={{ marginTop: space(1) }}>
              {timeOf(dose.plannedAt.replace('Z', '').slice(0, 19))} · {dose.name}
            </Txt>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
        <Tile
          icon="heart"
          label={t('heartRate')}
          value={view.vitals?.heartRate ? `${Math.round(view.vitals.heartRate)}` : '—'}
          hint={view.vitals?.heartRateAt ? ago(toLocal(view.vitals.heartRateAt)) : null}
        />
        <Tile
          icon="moon"
          label={t('sleep')}
          value={view.vitals?.sleepMinutes ? duration(view.vitals.sleepMinutes) : '—'}
          hint={view.vitals?.sleepAt ? ago(toLocal(view.vitals.sleepAt)) : null}
        />
        <Tile
          icon="activity"
          label={t('steps')}
          value={view.vitals?.steps ? formatCount(view.vitals.steps) : '—'}
          hint={view.vitals?.stepsAt ? ago(toLocal(view.vitals.stepsAt)) : null}
        />
      </View>

      <View style={{ marginTop: space(4) }}>
        <Txt weight="semibold">
          {todayDoses.length > 0
            ? t('takenToday', { taken, total: todayDoses.length })
            : t('noPatientData')}
        </Txt>
        {todayDoses.length === 0 ? (
          <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(1) }}>
            {t('noPatientDataHint')}
          </Txt>
        ) : null}
      </View>

      <Gap size={4} />
      {phone ? (
        <Button
          label={t('callNow')}
          icon="call"
          onPress={() => void Linking.openURL(`tel:${phone}`)}
          large
        />
      ) : editingPhone ? (
        <>
          <Input
            label={t('patientPhone')}
            value={draft}
            onChangeText={setDraft}
            keyboardType="phone-pad"
            placeholder="+998 __ ___ __ __"
          />
          <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
            {t('patientPhoneHint')}
          </Txt>
          <Gap size={3} />
          <Button
            label={t('savePhone')}
            onPress={async () => {
              await onSavePhone(draft);
              setEditingPhone(false);
            }}
            disabled={draft.trim().length < 5}
          />
        </>
      ) : (
        <Button label={t('patientPhone')} icon="call" variant="soft" onPress={() => setEditingPhone(true)} />
      )}

      <Button label={t('unlink')} variant="ghost" onPress={onRemove} />
    </Card>
  );
}

/** Метка времени из облака приходит в UTC, а показываем местное. */
function toLocal(iso: string): string {
  return localISO(new Date(iso));
}

function Tile({
  icon,
  label,
  value,
  hint,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string | null;
}) {
  return (
    <View style={{ flex: 1, padding: space(3), borderRadius: radius.md, backgroundColor: color.app }}>
      <Icon name={icon} size={18} color={color.inkSoft} />
      <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(1) }}>
        {label}
      </Txt>
      <Txt variant="bodyLarge" weight="displayExtra" style={{ marginTop: space(1) }}>
        {value}
      </Txt>
      {hint ? (
        <Txt variant="caption" color={color.inkSoft}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** Собственные показатели — их же увидит ребёнок. */
function OwnVitals() {
  const { t } = useT();
  const bracelet = useHealth();
  const ago = useAgo();
  const duration = useDuration();
  const [progress, setProgress] = useState<DayProgress>({ taken: 0, total: 0 });

  useFocusEffect(
    useCallback(() => {
      dayProgress()
        .then(setProgress)
        .catch((error) => console.warn('[esla] прогресс дня не получен', error));
    }, []),
  );

  const { heartRate, steps, sleepMinutes } = bracelet.snapshot;

  return (
    <View style={{ gap: space(2) }}>
      <Caption>{t('myData')}</Caption>
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Tile
          icon="heart"
          label={t('heartRate')}
          value={heartRate ? `${Math.round(heartRate.value)}` : '—'}
          hint={heartRate ? ago(heartRate.measuredAt) : null}
        />
        <Tile
          icon="moon"
          label={t('sleep')}
          value={sleepMinutes ? duration(sleepMinutes.value) : '—'}
          hint={sleepMinutes ? ago(sleepMinutes.measuredAt) : null}
        />
        <Tile
          icon="activity"
          label={t('steps')}
          value={steps ? formatCount(steps.value) : '—'}
          hint={steps ? ago(steps.measuredAt) : null}
        />
      </View>

      <Card tint={color.lilacSoft}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) }}>
          <Txt weight="semibold" style={{ flex: 1 }}>
            {t('todayMedsProgress')}
          </Txt>
          <Txt variant="subtitle" weight="displayExtra">
            {progress.taken} / {progress.total}
          </Txt>
        </View>
      </Card>

      {!bracelet.checking && !bracelet.hasData ? (
        <Txt variant="caption" color={color.inkSoft}>
          {t('braceletWorksWithoutHint')}
        </Txt>
      ) : null}
    </View>
  );
}
