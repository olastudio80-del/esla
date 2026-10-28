import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LogoMark } from '@/components/Logo';
import { Appear } from '@/components/motion/Appear';
import { Button, Gap } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { Txt } from '@/components/ui/Txt';
import type { DoseWithMedication } from '@/db/types';
import { useHealth } from '@/hooks/useHealth';
import { useTodayDoses } from '@/hooks/useTodayDoses';
import { useT } from '@/i18n';
import { timeOf } from '@/lib/date';
import { useLabels } from '@/lib/labels';
import { usePrefs } from '@/store/prefs';
import { color, radius, semantic, space } from '@/theme/tokens';

export default function HomeScreen() {
  const { t } = useT();
  const { prefs } = usePrefs();
  const { current, today, progress, loading, act, snooze } = useTodayDoses();

  return (
    <Screen>
      <TopRow />

      <Appear>
        <View style={{ gap: space(1) }}>
          {/* Запятая только когда за приветствием следует имя. */}
          <Txt variant="bodyLarge" color={color.inkSoft}>
            {prefs.patientName ? `${t('greeting')},` : t('greeting')}
          </Txt>
          {prefs.patientName ? (
            <Txt variant="headline" weight="displayExtra">
              {prefs.patientName}
            </Txt>
          ) : null}
        </View>
      </Appear>

      {loading ? null : (
        <Appear index={1}>
          {current ? (
            <CurrentDoseCard
              dose={current}
              onTaken={() => act(current, 'taken')}
              onSnooze={() => snooze(current)}
            />
          ) : progress.total > 0 ? (
            <AllDoneCard />
          ) : (
            <NoMedicinesCard />
          )}
        </Appear>
      )}

      {today.length > 0 ? (
        <Appear index={2}>
          <TodayList doses={today} onPressDose={(d) => act(d, 'taken')} />
        </Appear>
      ) : null}

      <Appear index={3}>
        <AssistantRow />
      </Appear>
    </Screen>
  );
}

/** Логотип слева, состояние браслета справа — как в макете телефона из деки. */
function TopRow() {
  const { t } = useT();
  const bracelet = useHealth();
  const connected = bracelet.state === 'ready' && bracelet.hasData;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <LogoMark size={34} />
        <Txt variant="subtitle" weight="logo" color={color.plum}>
          esla
        </Txt>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={connected ? t('braceletConnected') : t('braceletOff')}
        onPress={() => router.push('/settings')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space(2),
          paddingHorizontal: space(3),
          paddingVertical: space(2),
          borderRadius: radius.pill,
          backgroundColor: connected ? color.sageSoft : color.card,
        }}
      >
        <Icon
          name="watch"
          size={18}
          color={connected ? color.sageDeep : color.inkSoft}
          strokeWidth={2.2}
        />
        <Txt variant="caption" weight="semibold" color={connected ? color.sageDeep : color.inkSoft}>
          {connected ? t('braceletConnected') : t('braceletOff')}
        </Txt>
      </Pressable>
    </View>
  );
}

/**
 * Главная карточка: одно действие на экране — «Ichdim». Всё остальное
 * второстепенно, поэтому кнопка самая крупная и единственная заметная.
 */
function CurrentDoseCard({
  dose,
  onTaken,
  onSnooze,
}: {
  dose: DoseWithMedication;
  onTaken: () => void;
  onSnooze: () => void;
}) {
  const { t } = useT();
  const labels = useLabels();
  const [snoozed, setSnoozed] = useState(false);
  const details = labels.doseDetails(dose.form, dose.meal);
  const missed = dose.status === 'missed';

  return (
    <Card tint={missed ? color.peachSoft : semantic.doseNow} raised>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Caption>{t('doseNowCaption')}</Caption>
        {missed ? <StatusPill status="missed" /> : <Icon name="watch" size={24} color={color.ink} />}
      </View>

      <Txt variant="display" weight="displayExtra" style={{ marginTop: space(2) }}>
        {timeOf(dose.planned_at)}
      </Txt>

      <Txt variant="subtitle" weight="bold" style={{ marginTop: space(1) }}>
        {dose.name}
        {dose.dosage ? ` ${dose.dosage}` : ''}
      </Txt>
      {details ? (
        <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(1) }}>
          {details}
        </Txt>
      ) : null}

      <Gap size={4} />
      <Button label={t('doseTaken')} icon="check" onPress={onTaken} large />

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onSnooze();
          setSnoozed(true);
        }}
        disabled={snoozed}
        style={{ alignSelf: 'center', paddingVertical: space(3), paddingHorizontal: space(4) }}
      >
        <Txt variant="caption" weight="semibold" color={color.inkSoft}>
          {snoozed ? t('reminderSent') : t('doseSnooze')}
        </Txt>
      </Pressable>
    </Card>
  );
}

/** Все дозы приняты: похвала, а не пустой экран. */
function AllDoneCard() {
  const { t } = useT();
  return (
    <Card tint={color.sageSoft}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Icon name="check" size={30} color={color.sageDeep} strokeWidth={2.6} />
        <Txt variant="bodyLarge" weight="semibold" color={color.sageDeep} style={{ flex: 1 }}>
          {t('allDosesDone')}
        </Txt>
      </View>
    </Card>
  );
}

/** Лекарств нет вовсе — объясняем, что делать, и даём одну кнопку. */
function NoMedicinesCard() {
  const { t } = useT();
  return (
    <Card>
      <Txt variant="subtitle" weight="display">
        {t('noMedicines')}
      </Txt>
      <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(2) }}>
        {t('noMedicinesHint')}
      </Txt>
      <Gap size={4} />
      <Button
        label={t('addMedicine')}
        icon="plus"
        onPress={() => router.push('/medicine/add')}
        large
      />
    </Card>
  );
}

/** Список доз на день: время, название, статус. Нажатие отмечает приём. */
function TodayList({
  doses,
  onPressDose,
}: {
  doses: DoseWithMedication[];
  onPressDose: (dose: DoseWithMedication) => void;
}) {
  const { t } = useT();
  return (
    <View style={{ gap: space(2) }}>
      <Caption>{t('todayDoses')}</Caption>
      {doses.map((dose) => {
        const done = dose.status === 'taken' || dose.status === 'skipped';
        return (
          <Pressable
            key={dose.id}
            accessibilityRole="button"
            accessibilityLabel={`${timeOf(dose.planned_at)} ${dose.name}`}
            onPress={() => !done && onPressDose(dose)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(3),
              padding: space(4),
              borderRadius: radius.lg,
              backgroundColor: color.card,
              opacity: pressed && !done ? 0.85 : 1,
            })}
          >
            {/* Без фиксированной ширины: на крупном шрифте «14:00» в неё не влезает. */}
            <Txt variant="bodyLarge" weight="display">
              {timeOf(dose.planned_at)}
            </Txt>
            <View style={{ flex: 1 }}>
              {/* Две строки: длинные названия на крупном шрифте не обрезаются. */}
              <Txt weight="semibold" numberOfLines={2}>
                {dose.name}
              </Txt>
              {dose.dosage ? (
                <Txt variant="caption" color={color.inkSoft}>
                  {dose.dosage}
                </Txt>
              ) : null}
            </View>
            <StatusPill status={dose.status} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Вход в голосового помощника: крупная цель нажатия, подпись словами. */
function AssistantRow() {
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('talkToAssistant')}
      onPress={() => router.push('/assistant')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        padding: space(3),
        paddingRight: space(5),
        borderRadius: radius.pill,
        backgroundColor: semantic.assistant,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: color.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="mic" size={24} color={color.ink} />
      </View>
      <Txt variant="bodyLarge" weight="bold" style={{ flex: 1 }}>
        {t('talkToAssistant')}
      </Txt>
    </Pressable>
  );
}
