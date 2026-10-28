import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from './Button';
import { Caption } from './Card';
import { Txt } from './Txt';

import { useT } from '@/i18n';
import { hhmm } from '@/lib/date';
import { color, radius, space } from '@/theme/tokens';

export type TimeValue = { hour: number; minute: number };

/** Часы, в которые реально назначают приём: ночь не предлагаем. */
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 5..23
const MINUTES = [0, 15, 30, 45];

/**
 * Выбор времени приёма сеткой, а не системным «колесом».
 *
 * Колесо требует точного перетаскивания — для дрожащих рук это плохая
 * мишень, и промах означает неверное время приёма лекарства. Сетка из
 * крупных кнопок надёжнее: одно нажатие, видно результат.
 */
export function TimeGrid({ onAdd, onCancel }: { onAdd: (value: TimeValue) => void; onCancel: () => void }) {
  const { t } = useT();
  const [hour, setHour] = useState<number | null>(null);
  const [minute, setMinute] = useState(0);

  return (
    <View style={{ gap: space(3) }}>
      <Caption>{t('intakeTime')}</Caption>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          {HOURS.map((h) => (
            <Cell key={h} label={String(h).padStart(2, '0')} selected={hour === h} onPress={() => setHour(h)} />
          ))}
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        {MINUTES.map((m) => (
          <Cell
            key={m}
            label={`:${String(m).padStart(2, '0')}`}
            selected={minute === m}
            onPress={() => setMinute(m)}
            flex
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Button label={t('cancel')} variant="soft" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          label={hour == null ? t('add') : `${t('add')} ${hhmm(hour, minute)}`}
          onPress={() => hour != null && onAdd({ hour, minute })}
          disabled={hour == null}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

function Cell({
  label,
  selected,
  onPress,
  flex = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  flex?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: flex ? 1 : undefined,
        minWidth: 56,
        minHeight: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        backgroundColor: selected ? color.ink : color.card,
      }}
    >
      <Txt variant="bodyLarge" weight="bold" color={selected ? color.card : color.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}
