import { View } from 'react-native';

import { Txt } from './Txt';

import { useT } from '@/i18n';
import type { DoseStatus } from '@/db/types';
import { color, radius, semantic, space } from '@/theme/tokens';

const LOOK: Record<DoseStatus, { bg: string; fg: string }> = {
  taken: { bg: semantic.doseTaken, fg: semantic.doseTakenText },
  planned: { bg: semantic.doseWaiting, fg: color.ink },
  missed: { bg: semantic.doseMissed, fg: color.card },
  skipped: { bg: color.line, fg: color.inkSoft },
};

const LABEL = {
  taken: 'statusTaken',
  planned: 'statusWaiting',
  missed: 'statusMissed',
  skipped: 'doseSkip',
} as const;

/** Статус дозы: цвет и слово, не только цвет — на случай плохого зрения. */
export function StatusPill({ status }: { status: DoseStatus }) {
  const { t } = useT();
  const look = LOOK[status];
  return (
    <View
      style={{
        paddingHorizontal: space(3),
        paddingVertical: space(2),
        borderRadius: radius.pill,
        backgroundColor: look.bg,
      }}
    >
      <Txt variant="caption" weight="semibold" color={look.fg}>
        {t(LABEL[status])}
      </Txt>
    </View>
  );
}
