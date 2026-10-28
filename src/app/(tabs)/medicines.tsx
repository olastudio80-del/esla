import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { InteractionWarning } from '@/components/InteractionWarning';
import { ParentMedicines } from '@/components/ParentMedicines';
import { findInteractions } from '@/data/interactions';
import { useFamily } from '@/hooks/useFamily';
import { usePrefs } from '@/store/prefs';

import { Button, Gap, IconButton } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import type { Medication } from '@/db/types';
import { useMedications } from '@/hooks/useMedications';
import { useT } from '@/i18n';
import { addDays, dateKey, daysBetween, hhmm } from '@/lib/date';
import { useLabels } from '@/lib/labels';
import { color, radius, space } from '@/theme/tokens';

export default function MedicinesScreen() {
  const { prefs } = usePrefs();
  // У родственника этот раздел показывает лекарства родителя, а не его
  // собственные: он пришёл посмотреть, что назначено отцу.
  return prefs.role === 'relative' ? <RelativeView /> : <OwnMedicines />;
}

/** Лекарства родителя — только чтение. */
function RelativeView() {
  const { t } = useT();
  const family = useFamily();

  return (
    <Screen>
      {family.selected ? (
        <ParentMedicines view={family.selected} />
      ) : (
        <Card>
          <Txt variant="subtitle" weight="display">
            {t('noParentSelected')}
          </Txt>
          <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(2) }}>
            {t('familyEmptyHint')}
          </Txt>
        </Card>
      )}
    </Screen>
  );
}

function OwnMedicines() {
  const { t } = useT();
  const { items, loading, remove } = useMedications();

  // Сочетания пересчитываются при каждом изменении списка: человек мог
  // добавить лекарство на другом экране или удалить одно из пары.
  const findings = useMemo(
    () => findInteractions(items.map((m) => ({ name: m.name, inn: m.catalog_id }))),
    [items],
  );
  const hasManual = useMemo(() => items.some((m) => !m.catalog_id), [items]);

  return (
    <Screen
      footer={
        items.length > 0 ? (
          <Button
            label={t('addMedicine')}
            icon="plus"
            onPress={() => router.push('/medicine/add')}
            large
          />
        ) : null
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <SectionTitle title={t('medicinesTitle')} />
        </View>
        <IconButton name="settings" label={t('settings')} onPress={() => router.push('/settings')} />
      </View>

      {loading ? null : items.length === 0 ? (
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
      ) : (
        <>
          {items.map((med) => (
            <MedicineCard key={med.id} med={med} onRemove={() => confirmRemove(med)} />
          ))}
          {items.length > 1 ? (
            <InteractionWarning findings={findings} hasManualEntries={hasManual} />
          ) : null}
        </>
      )}
    </Screen>
  );

  function confirmRemove(med: Medication) {
    Alert.alert(t('deleteMedicineConfirm', { name: med.name }), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => void remove(med.id) },
    ]);
  }
}

function MedicineCard({ med, onRemove }: { med: Medication; onRemove: () => void }) {
  const { t } = useT();
  const labels = useLabels();
  const details = labels.doseDetails(med.form, med.meal);

  // Сколько ещё дней курса осталось — для постоянного приёма не показываем.
  const left =
    med.course_days == null
      ? null
      : Math.max(0, daysBetween(dateKey(), addDays(med.started_on, med.course_days - 1)) + 1);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(3) }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.md,
            backgroundColor: color.blushSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="pill" size={26} color={color.ink} />
        </View>

        <View style={{ flex: 1, gap: space(1) }}>
          <Txt variant="bodyLarge" weight="bold">
            {med.name}
            {med.dosage ? ` ${med.dosage}` : ''}
          </Txt>
          {details ? (
            <Txt variant="caption" color={color.inkSoft}>
              {details}
            </Txt>
          ) : null}
          <Txt variant="caption" color={color.inkSoft}>
            {left == null ? t('courseOngoing') : t('courseDays', { n: left })}
          </Txt>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('delete')}
          onPress={onRemove}
          hitSlop={12}
          style={{ padding: space(2) }}
        >
          <Icon name="x" size={22} color={color.inkSoft} />
        </Pressable>
      </View>

      {med.times.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(4) }}>
          {med.times.map((time) => (
            <View
              key={time.id}
              style={{
                paddingHorizontal: space(4),
                paddingVertical: space(2),
                borderRadius: radius.sm,
                backgroundColor: color.lilacSoft,
              }}
            >
              <Txt weight="bold">{hhmm(time.hour, time.minute)}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
