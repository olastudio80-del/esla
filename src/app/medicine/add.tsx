import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Button, Gap, IconButton, Pill } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { TimeGrid, type TimeValue } from '@/components/ui/TimeGrid';
import { Txt } from '@/components/ui/Txt';
import { createMedication } from '@/db/medications';
import type { Meal } from '@/db/types';
import { searchCatalog, type CatalogEntry } from '@/data/medicines';
import { rescheduleAll, requestPermission } from '@/features/notifications';
import { useT } from '@/i18n';
import { hhmm } from '@/lib/date';
import { useLabels } from '@/lib/labels';
import { usePrefs } from '@/store/prefs';
import { color, space } from '@/theme/tokens';

/** Времена, которые назначают чаще всего — одно нажатие вместо выбора в сетке. */
const PRESET_TIMES: TimeValue[] = [
  { hour: 8, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 20, minute: 0 },
];

const COURSE_PRESETS = [7, 10, 14, 30];

export default function AddMedicineScreen() {
  const { t, lang } = useT();
  const { prefs } = usePrefs();
  const labels = useLabels();

  const [name, setName] = useState('');
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState<TimeValue[]>([]);
  const [meal, setMeal] = useState<Meal>('any');
  const [courseDays, setCourseDays] = useState<number | null>(null);
  const [pickingTime, setPickingTime] = useState(false);
  const [saving, setSaving] = useState(false);

  // Подсказки ищем только пока препарат не выбран: после выбора список
  // поверх заполненного поля только мешает.
  const hits = useMemo(() => (picked ? [] : searchCatalog(name)), [name, picked]);

  const canSave = name.trim().length >= 2 && times.length > 0;

  return (
    <Screen
      footer={
        <Button
          label={t('save')}
          onPress={save}
          disabled={!canSave}
          busy={saving}
          large
        />
      }
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
          // иначе сохранили бы чужую форму выпуска.
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
          {hits.map(({ entry, matched }) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              onPress={() => {
                setPicked(entry);
                setName(lang === 'ru' ? entry.ru : entry.uz);
                // Единственную зарегистрированную дозировку подставляем сразу.
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
                <Txt weight="semibold">{matched}</Txt>
                <Txt variant="caption" color={color.inkSoft}>
                  {labels.form(entry.form)}
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

      <Input
        label={t('dosage')}
        placeholder={picked?.strengths[0] ?? '500 mg'}
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
        <Caption>{t('intakeTime')}</Caption>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {mergedTimes().map((time) => {
            const label = hhmm(time.hour, time.minute);
            const on = times.some((x) => x.hour === time.hour && x.minute === time.minute);
            return <Pill key={label} label={label} selected={on} onPress={() => toggleTime(time)} />;
          })}
          {!pickingTime ? (
            <Pill label={`+ ${t('addTime')}`} onPress={() => setPickingTime(true)} tint={color.card} />
          ) : null}
        </View>

        {pickingTime ? (
          <Card tint={color.app}>
            <TimeGrid
              onAdd={(value) => {
                toggleTime(value, true);
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
          {(['after', 'before', 'any'] as Meal[]).map((value) => (
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
            onPress={() => setCourseDays(null)}
            tint={color.peachSoft}
          />
          {COURSE_PRESETS.map((days) => (
            <Pill
              key={days}
              label={t('courseDays', { n: days })}
              selected={courseDays === days}
              onPress={() => setCourseDays(days)}
              tint={color.peachSoft}
            />
          ))}
        </View>
      </View>

      <Gap size={2} />
    </Screen>
  );

  /** Пресеты плюс всё, что пользователь добавил сам, по возрастанию. */
  function mergedTimes(): TimeValue[] {
    const seen = new Map<string, TimeValue>();
    for (const time of [...PRESET_TIMES, ...times]) {
      seen.set(hhmm(time.hour, time.minute), time);
    }
    return [...seen.values()].sort((a, b) => a.hour - b.hour || a.minute - b.minute);
  }

  function toggleTime(value: TimeValue, forceOn = false) {
    setTimes((prev) => {
      const exists = prev.some((x) => x.hour === value.hour && x.minute === value.minute);
      if (exists && !forceOn) {
        return prev.filter((x) => !(x.hour === value.hour && x.minute === value.minute));
      }
      if (exists) return prev;
      return [...prev, value];
    });
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
        catalogId: picked?.id ?? null,
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
