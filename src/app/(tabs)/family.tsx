import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';

import { Appear } from '@/components/motion/Appear';
import { ECGLine } from '@/components/motion/ECGLine';
import { Button, Gap, Pill } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { symptomById } from '@/data/symptoms';
import { getAllPhones, setPhone } from '@/features/cloud/contacts';
import { useFamily, type PatientView } from '@/hooks/useFamily';
import { usePush } from '@/hooks/usePush';
import { useT } from '@/i18n';
import { localISO, minutesBetween, timeOf } from '@/lib/date';
import { formatCount, useAgo, useDuration } from '@/lib/format';
import { color, radius, semantic, space } from '@/theme/tokens';

/**
 * «Holat» — главный экран того, кто следит за родителями.
 *
 * Порядок блоков повторяет макет проекта и отвечает на вопросы в том
 * порядке, в каком их задаёт человек, открывший приложение: всё ли в
 * порядке (тревога), как он себя чувствует (пульс, сон, шаги), принял ли
 * лекарства (чипы за день).
 *
 * Тревога стоит первой и занимает всю ширину: ради неё приложение и
 * открывают, и искать её глазами человек не должен.
 */
export default function FamilyScreen() {
  const { t } = useT();
  const family = useFamily();
  // Этот телефон — получатель тревог о родителях, поэтому регистрируем его
  // здесь: экран «Holat» открывает именно тот, кто следит.
  const push = usePush();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [phones, setPhones] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      getAllPhones().then(setPhones).catch(() => {});
    }, []),
  );

  const view: PatientView | null = family.selected;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="title" weight="display">
          {t('familyTitle')}
        </Txt>
        <Pill label={`+ ${t('addRelative')}`} onPress={() => setAdding((v) => !v)} tint={color.card} />
      </View>

      {/* Показываем только то, что человек может исправить: запрет
          уведомлений. Работающий push молчит — на экране про здоровье
          родителей нет места отчётам об исправности. */}
      {push.state === 'denied' ? (
        <Card tint={color.blushSoft}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name="bell" size={22} color={color.rose} />
            <Txt weight="semibold" style={{ flex: 1 }}>
              {t('pushDenied')}
            </Txt>
          </View>
          <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
            {t('pushDeniedHint')}
          </Txt>
          <Gap size={3} />
          <Button label={t('pushRetry')} variant="soft" onPress={push.retry} />
        </Card>
      ) : null}

      {family.views.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            {family.views.map((item) => (
              <PatientChip
                key={item.patient.id}
                name={item.patient.name ?? t('roleRelative')}
                selected={item.patient.id === view?.patient.id}
                alarm={item.unseenAlarm !== null || item.missedToday.length > 0}
                onPress={() => family.select(item.patient.id)}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}

      {adding || family.views.length === 0 ? (
        <Card tint={color.app}>
          <Input
            label={t('enterCodeTitle')}
            value={code}
            onChangeText={(value) => {
              setCode(value.toUpperCase().replace(/\s/g, ''));
              setCodeError(false);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            placeholder="ABC123"
            style={{ letterSpacing: 4 }}
          />
          {codeError ? (
            <Txt variant="caption" color={color.roseText} style={{ marginTop: space(2) }}>
              {t('codeWrong')}
            </Txt>
          ) : null}
          {family.views.length === 0 && !adding ? (
            <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
              {t('familyEmptyHint')}
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
                setAdding(false);
              } else {
                setCodeError(true);
              }
            }}
            disabled={code.length < 6}
            busy={family.busy}
            large
          />
        </Card>
      ) : null}

      {view ? (
        <Appear index={1}>
          <PatientStatus
            view={view}
            phone={phones[view.patient.id] ?? null}
            onSavePhone={async (value) => {
              await setPhone(view.patient.id, value);
              setPhones(await getAllPhones());
            }}
            onRemove={() =>
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
              )
            }
          />
        </Appear>
      ) : null}
    </Screen>
  );
}

/** Кружок с инициалами и имя — переключение между родителями. */
function PatientChip({
  name,
  selected,
  alarm,
  onPress,
}: {
  name: string;
  selected: boolean;
  alarm: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(2),
        paddingLeft: space(1),
        paddingRight: space(4),
        paddingVertical: space(1),
        borderRadius: radius.pill,
        backgroundColor: selected ? color.ink : color.card,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: alarm ? color.rose : color.peach,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt variant="caption" weight="display" color={alarm ? color.card : color.ink}>
          {initials(name)}
        </Txt>
      </View>
      <Txt weight="semibold" color={selected ? color.card : color.ink}>
        {name}
      </Txt>
    </Pressable>
  );
}

function PatientStatus({
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
  const [draft, setDraft] = useState('');
  const [reminded, setReminded] = useState(false);

  const name = view.patient.name ?? t('roleRelative');
  const missed = view.missedToday[0];
  const alarm = view.unseenAlarm;

  return (
    <>
      {/* Тревожный симптом важнее пропущенной дозы — показываем его первым. */}
      {alarm ? (
        <AlertCard
          title={t('alarmFromPatient', { name })}
          detail={alarm.symptoms
            .map((id) => {
              const symptom = symptomById(id);
              return symptom ? (lang === 'ru' ? symptom.ru : symptom.uz) : id;
            })
            .join(', ')}
          phone={phone}
          onAddPhone={() => setEditingPhone(true)}
          onRemind={() => setReminded(true)}
          reminded={reminded}
        />
      ) : missed ? (
        <AlertCard
          title={t('missedDoseAlert', { name, time: timeOf(localTime(missed.plannedAt)) })}
          detail={`${missed.name}${missed.dosage ? ` ${missed.dosage}` : ''} · ${t('minutesPassed', {
            n: Math.max(1, minutesBetween(localTime(missed.plannedAt), localISO())),
          })}`}
          phone={phone}
          onAddPhone={() => setEditingPhone(true)}
          onRemind={() => setReminded(true)}
          reminded={reminded}
        />
      ) : null}

      {editingPhone && !phone ? (
        <Card tint={color.app}>
          <Input
            label={t('patientPhone')}
            value={draft}
            onChangeText={setDraft}
            keyboardType="phone-pad"
            placeholder="+998 __ ___ __ __"
            autoFocus
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
        </Card>
      ) : null}

      {/* Пульс с кардиограммой — главный показатель на экране. */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Icon name="heart" size={20} color={color.rose} filled />
            <Txt weight="semibold" color={color.inkSoft}>
              {t('heartRate')}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space(1) }}>
            <Txt variant="headline" weight="displayExtra">
              {view.vitals?.heartRate ? Math.round(view.vitals.heartRate) : '—'}
            </Txt>
            <Txt variant="caption" color={color.inkSoft}>
              {t('bpm')}
            </Txt>
          </View>
        </View>
        <Gap size={2} />
        <ECGLine />
        {view.vitals?.heartRateAt ? (
          <Txt variant="caption" color={color.inkSoft}>
            {ago(localTime(view.vitals.heartRateAt))}
          </Txt>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Tile
          icon="moon"
          label={t('sleep')}
          value={view.vitals?.sleepMinutes ? duration(view.vitals.sleepMinutes) : '—'}
        />
        <Tile
          icon="activity"
          label={t('steps')}
          value={view.vitals?.steps ? formatCount(view.vitals.steps) : '—'}
        />
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt weight="semibold">{t('todayMedsProgress')}</Txt>
          <Txt variant="subtitle" weight="displayExtra">
            {view.takenToday} / {view.todayDoses.length}
          </Txt>
        </View>

        {view.todayDoses.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) }}>
            {view.todayDoses.map((dose) => (
              <DoseChip
                key={dose.localId}
                time={timeOf(localTime(dose.plannedAt))}
                status={dose.status}
              />
            ))}
          </View>
        ) : (
          <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
            {t('noPatientDataHint')}
          </Txt>
        )}
      </Card>

      <Txt variant="caption" color={color.inkSoft} align="center">
        {view.patient.lastSeenAt
          ? t('lastSeen', { ago: ago(localTime(view.patient.lastSeenAt)) })
          : t('neverSeen')}
      </Txt>

      <Button label={t('unlink')} variant="ghost" onPress={onRemove} />
    </>
  );
}

/** Карточка тревоги: одно крупное сообщение и два действия. */
function AlertCard({
  title,
  detail,
  phone,
  onAddPhone,
  onRemind,
  reminded,
}: {
  title: string;
  detail: string;
  phone: string | null;
  onAddPhone: () => void;
  onRemind: () => void;
  reminded: boolean;
}) {
  const { t } = useT();
  return (
    <Card tint={semantic.danger} raised>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(3) }}>
        <Icon name="bell" size={24} color={color.card} strokeWidth={2.4} />
        <Txt variant="bodyLarge" weight="bold" color={color.card} style={{ flex: 1 }}>
          {title}
        </Txt>
      </View>
      <Txt variant="caption" color={color.card} style={{ marginTop: space(2), opacity: 0.92 }}>
        {detail}
      </Txt>

      <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
        <Button
          label={t('callNow')}
          icon="call"
          variant="soft"
          onPress={() => (phone ? void Linking.openURL(`tel:${phone}`) : onAddPhone())}
          style={{ flex: 1 }}
        />
        <Button
          label={reminded ? t('reminderSent') : t('remindAgain')}
          variant="ghost"
          onPress={onRemind}
          disabled={reminded}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

/** Чип приёма: время и знак — принято, пропущено или ещё впереди. */
function DoseChip({ time, status }: { time: string; status: string }) {
  const look =
    status === 'taken'
      ? { bg: color.sageSoft, fg: color.sageDeep, icon: 'check' as IconName }
      : status === 'missed'
        ? { bg: color.rose, fg: color.card, icon: 'x' as IconName }
        : { bg: color.lilacSoft, fg: color.ink, icon: null };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(1),
        paddingHorizontal: space(3),
        paddingVertical: space(2),
        borderRadius: radius.sm,
        backgroundColor: look.bg,
      }}
    >
      {look.icon ? <Icon name={look.icon} size={15} color={look.fg} strokeWidth={3} /> : null}
      <Txt weight="bold" color={look.fg}>
        {time}
      </Txt>
    </View>
  );
}

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Icon name={icon} size={18} color={color.inkSoft} />
        <Txt variant="caption" color={color.inkSoft}>
          {label}
        </Txt>
      </View>
      <Txt variant="subtitle" weight="displayExtra" style={{ marginTop: space(2) }}>
        {value}
      </Txt>
    </Card>
  );
}

/** Из облака время приходит в UTC, показываем местное. */
function localTime(iso: string): string {
  return localISO(new Date(iso));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}
