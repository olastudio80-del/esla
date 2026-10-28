import { View } from 'react-native';

import { Card, SectionTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import type { PatientView } from '@/hooks/useFamily';
import { useT } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';

/**
 * Лекарства родителя глазами ребёнка — только чтение.
 *
 * Менять назначения отсюда нельзя намеренно: лекарства заводит тот, кто
 * их принимает, по рецепту врача. Ребёнок видит, что назначено и когда,
 * чтобы понимать происходящее и разговаривать предметно.
 */
export function ParentMedicines({ view }: { view: PatientView }) {
  const { t } = useT();
  const name = view.patient.name ?? t('roleRelative');

  return (
    <>
      <SectionTitle title={t('parentMedicines', { name })} />

      {view.medicines.length === 0 ? (
        <Card>
          <Txt variant="body" color={color.inkSoft}>
            {t('noPatientDataHint')}
          </Txt>
        </Card>
      ) : (
        view.medicines.map((med) => (
          <Card key={`${med.name}-${med.dosage ?? ''}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: color.blushSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="pill" size={24} color={color.ink} />
              </View>
              <Txt variant="bodyLarge" weight="bold" style={{ flex: 1 }}>
                {med.name}
                {med.dosage ? ` ${med.dosage}` : ''}
              </Txt>
            </View>

            {med.times.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(4) }}>
                {med.times.map((time) => (
                  <View
                    key={time}
                    style={{
                      paddingHorizontal: space(4),
                      paddingVertical: space(2),
                      borderRadius: radius.sm,
                      backgroundColor: color.lilacSoft,
                    }}
                  >
                    <Txt weight="bold">{time}</Txt>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}
