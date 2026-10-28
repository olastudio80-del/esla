import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { InteractionWarning } from '@/components/InteractionWarning';
import { Button, Gap, IconButton, Pill } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { TimeGrid, type TimeValue } from '@/components/ui/TimeGrid';
import { Txt } from '@/components/ui/Txt';
import { createMedication, listMedications } from '@/db/medications';
import type { Meal } from '@/db/types';
import { findInteractions, type InteractionFinding } from '@/data/interactions';
import { searchCatalog, type CatalogEntry } from '@/data/medicines';
import { rescheduleAll, requestPermission } from '@/features/notifications';
import { useT } from '@/i18n';
import { hhmm } from '@/lib/date';
import { useLabels } from '@/lib/labels';
import { usePrefs } from '@/store/prefs';
import { color, space } from '@/theme/tokens';

/**
 * Готовые расписания под «сколько раз в день».
 *
 * В рецепте пишут «3 раза в день», а не «в 8:00, 14:00 и 20:00». Человек
 * выбирает число, приложение расставляет часы — и их можно поправить.
 * Времена выбраны так, чтобы промежутки были ровными, а ночью не будило.
 */
const SCHEDULES: Record<number, TimeValue[]> = {
  1: [{ hour: 9, minute: 0 }],
  2: [
    { hour: 9, minute: 0 },
    { hour: 21, minute: 0 },
  ],
  3: [
    { hour: 8, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 20, minute: 0 },
  ],
  4: [
    { hour: 8, minute: 0 },
    { hour: 12, minute: 0 },
    { hour: 16, minute: 0 },
    { hour: 20, minute: 0 },
  ],
};

export default function AddMedicineScreen() {
  const { t } = useT();
  const { prefs } = usePrefs();
  const labels = useLabels();

  const [name, setName] = useState('');
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState<TimeValue[]>([]);
  const [meal, setMeal] = useState<Meal>('any');
  const [courseDays, setCourseDays] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState('');
  const [pickingTime, setPickingTime] = useState(false);
  const [saving, setSaving] = useState(false);
  /**
   * Результат проверки вместе с препаратом, для которого он получен.
   * Без этой привязки при смене препарата на мгновение показались бы
   * предупреждения от предыдущего — в медицинском предупреждении
   * такая подмена недопустима.
   */
  const [checked, setChecked] = useState<{
    for: string;
    findings: InteractionFinding[];
    hasManual: boolean;
  } | null>(null);

  // Подсказки ищем только пока препарат не выбран: после выбора список
  // поверх заполненного поля только мешает.
  const hits = useMemo(() => (picked ? [] : searchCatalog(name)), [name, picked]);

  // Сочетания проверяем, как только известно действующее вещество.
  useEffect(() => {
    const entry = picked;
    if (!entry?.inn) return;

    let alive = true;
    listMedications()
      .then((existing) => {
        if (!alive) return;
        setChecked({
          for: entry.name,
          hasManual: existing.some((m) => !m.catalog_id),
          findings: findInteractions([
            ...existing.map((m) => ({ name: m.name, inn: m.catalog_id })),
            { name: entry.name, inn: entry.inn },
          ]),
        });
      })
      .catch((error) => console.warn('[esla] проверка сочетаний не удалась', error));
    return () => {
      alive = false;
    };
  }, [picked]);

  const canSave = name.trim().length >= 2 && times.length > 0;

  return (
    <Screen
      footer={<Button label={t('save')} onPress={save} disabled={!canSave} busy={saving} large />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <IconButton name="left" label={t('back')} onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Txt variant="title" weight="display">
            {t('addMedicine')}
          </Txt>
          <Txt variant="caption" color={color.inkSoft}>
            {t('addMedicineSubtitle')}
          </Txt>
        </View>
      </View>

      <Input
        label={t('medicineName')}
        placeholder={t('medicineNamePlaceholder')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          // Правка названия вручную отменяет выбор из справочника:
          // иначе сохранили бы чужую форму выпуска и чужое вещество.
          if (picked) setPicked(null);
        }}
        accent
        autoCorrect={false}
        autoCapitalize="words"
      />

      {hits.length > 0 ? (
        <Card padded={false} style={{ paddingVertical: space(2) }}>
          <View style={{ paddingHorizontal: space(4), paddingBottom: space(2) }}>
            <Caption>{t('fromCatalog')}</Caption>
          </View>
          {hits.map(({ entry }) => (
            <Pressable
              key={`${entry.name}-${entry.form}`}
              accessibilityRole="button"
              onPress={() => {
                setPicked(entry);
                setName(entry.name);
                if (entry.strengths.length === 1) setDosage(entry.strengths[0]);
              }}
              style={({ pressed }) => ({
                paddingHorizontal: space(4),
                paddingVertical: space(3),
                backgroundColor: pressed ? color.blushSoft : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                gap: space(3),
              })}
            >
              <Icon name="pill" size={22} color={color.inkSoft} />
              <View style={{ flex: 1 }}>
                <Txt weight="semibold">{entry.name}</Txt>
                {/* Действующее вещество: по нему видно, что это за лекарство,
                    когда торговое название ни о чём не говорит. */}
                <Txt variant="caption" color={color.inkSoft}>
                  {[labels.form(entry.form), entry.inn].filter(Boolean).join(' · ')}
                </Txt>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {name.trim().length >= 2 && hits.length === 0 && !picked ? (
        <Txt variant="caption" color={color.inkSoft}>
          {t('catalogEmpty')}
        </Txt>
      ) : null}

      {/* Показываем только проверку, относящуюся к выбранному сейчас препарату. */}
      {picked && checked?.for === picked.name ? (
        <InteractionWarning
          findings={checked.findings}
          hasManualEntries={checked.hasManual && checked.findings.length > 0}
        />
      ) : null}

      <Input
        label={t('dosage')}
        placeholder={picked?.strengths[0] ?? '500 мг'}
        value={dosage}
        onChangeText={setDosage}
      />

      {picked && picked.strengths.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            {picked.strengths.map((value) => (
              <Pill
                key={value}
                label={value}
                selected={dosage === value}
                onPress={() => setDosage(value)}
                tint={color.blushSoft}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}

      <View style={{ gap: space(3) }}>
        <Caption>{t('timesPerDay')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {([1, 2, 3, 4] as const).map((count) => (
            <Pill
              key={count}
              label={
                count === 1
                  ? t('timesOnce')
                  : count === 2
                    ? t('timesTwice')
                    : count === 3
                      ? t('timesThrice')
                      : t('timesFour')
              }
              selected={matchesSchedule(times, count)}
              onPress={() => setTimes(SCHEDULES[count])}
              tint={color.lilacSoft}
            />
          ))}
        </View>
        <Txt variant="caption" color={color.inkSoft}>
          {t('timesHint')}
        </Txt>
      </View>

      <View style={{ gap: space(3) }}>
        <Caption>{t('intakeTime')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {times
            .slice()
            .sort((a, b) => a.hour - b.hour || a.minute - b.minute)
            .map((time) => (
              <Pill
                key={hhmm(time.hour, time.minute)}
                label={hhmm(time.hour, time.minute)}
                selected
                onPress={() => removeTime(time)}
              />
            ))}
          {!pickingTime ? (
            <Pill label={`+ ${t('addTime')}`} onPress={() => setPickingTime(true)} tint={color.card} />
          ) : null}
        </View>

        {pickingTime ? (
          <Card tint={color.app}>
            <TimeGrid
              onAdd={(value) => {
                addTime(value);
                setPickingTime(false);
              }}
              onCancel={() => setPickingTime(false)}
            />
          </Card>
        ) : null}
      </View>

      <View style={{ gap: space(3) }}>
        <Caption>{t('mealRelation')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {(['before', 'with', 'after', 'any'] as Meal[]).map((value) => (
            <Pill
              key={value}
              label={value === 'any' ? t('anyTime') : (labels.meal(value) ?? '')}
              selected={meal === value}
              onPress={() => setMeal(value)}
              tint={color.sageSoft}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space(3) }}>
        <Caption>{t('courseLength')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Pill
            label={t('courseOngoing')}
            selected={courseDays === null}
            onPress={() => {
              setCourseDays(null);
              setCustomDays('');
            }}
            tint={color.peachSoft}
          />
          {[
            { days: 7, label: t('courseDays', { n: 7 }) },
            { days: 14, label: t('courseDays', { n: 14 }) },
            { days: 30, label: t('courseMonth') },
            { days: 60, label: t('courseTwoMonths') },
          ].map((preset) => (
            <Pill
              key={preset.days}
              label={preset.label}
              selected={courseDays === preset.days}
              onPress={() => {
                setCourseDays(preset.days);
                setCustomDays('');
              }}
              tint={color.peachSoft}
            />
          ))}
        </View>

        {/* Врач может назначить любой срок — 5 дней, 21 день, 45 дней. */}
        <Input
          label={t('courseCustom')}
          placeholder={t('courseDaysInput')}
          value={customDays}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, '').slice(0, 3);
            setCustomDays(digits);
            const days = Number(digits);
            setCourseDays(days > 0 ? days : null);
          }}
          keyboardType="number-pad"
        />
      </View>

      <Gap size={2} />
    </Screen>
  );

  /** Совпадает ли текущий набор времён с готовым расписанием. */
  function matchesSchedule(current: TimeValue[], count: number): boolean {
    const preset = SCHEDULES[count];
    if (current.length !== preset.length) return false;
    return preset.every((p) =>
      current.some((c) => c.hour === p.hour && c.minute === p.minute),
    );
  }

  function addTime(value: TimeValue) {
    setTimes((prev) =>
      prev.some((x) => x.hour === value.hour && x.minute === value.minute)
        ? prev
        : [...prev, value],
    );
  }

  function removeTime(value: TimeValue) {
    setTimes((prev) =>
      prev.filter((x) => !(x.hour === value.hour && x.minute === value.minute)),
    );
  }

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await createMedication({
        name,
        dosage: dosage || null,
        form: picked?.form ?? null,
        meal,
        courseDays,
        // Храним действующее вещество: оно переживёт смену торговой марки,
        // говорит помощнику, что именно человек принимает, и по нему
        // проверяются сочетания.
        catalogId: picked?.inn ?? null,
        times,
      });

      // Разрешение спрашиваем именно здесь: человек только что завёл
      // лекарство и ждёт напоминаний — просьба понятна по контексту.
      const granted = await requestPermission();
      if (granted) {
        await rescheduleAll(prefs.lang);
      } else {
        Alert.alert(t('notificationsOff'), t('notificationsDeniedHint'));
      }
      router.back();
    } catch (error) {
      console.warn('[esla] не удалось сохранить лекарство', error);
      Alert.alert(t('retry'));
      setSaving(false);
    }
  }
}
