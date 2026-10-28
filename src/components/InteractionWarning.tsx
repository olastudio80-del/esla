import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import type { InteractionFinding } from '@/data/interactions';
import { useT } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';

/**
 * Предупреждение о сочетании лекарств.
 *
 * Тон выбран намеренно: «обсудите с врачом», а не «нельзя принимать».
 * Врач мог назначить такое сочетание осознанно и под контролем анализов,
 * и приложение, отменяющее его назначение, опаснее молчащего. Поэтому
 * здесь нет кнопок «убрать лекарство» и ничего не блокируется.
 *
 * Оговорка о неполноте проверки стоит внизу и не прячется: пустой список
 * иначе прочитается как «всё безопасно», а это неправда.
 */
export function InteractionWarning({
  findings,
  hasManualEntries,
}: {
  findings: InteractionFinding[];
  /** Есть ли лекарства, вписанные вручную — они в проверку не попадают. */
  hasManualEntries: boolean;
}) {
  const { t, lang } = useT();
  if (findings.length === 0 && !hasManualEntries) return null;

  return (
    <Card tint={findings.length > 0 ? color.peachSoft : color.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Icon
          name={findings.length > 0 ? 'alert' : 'shield'}
          size={24}
          color={findings.length > 0 ? color.roseText : color.inkSoft}
        />
        <Txt variant="bodyLarge" weight="display" style={{ flex: 1 }}>
          {t('interactionsTitle')}
        </Txt>
      </View>

      {findings.length === 0 ? (
        <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(3) }}>
          {t('interactionNone')}
        </Txt>
      ) : (
        findings.map((finding) => (
          <View
            key={`${finding.rule.id}-${finding.first}-${finding.second}`}
            style={{
              marginTop: space(3),
              padding: space(4),
              borderRadius: radius.lg,
              backgroundColor: color.card,
              gap: space(2),
            }}
          >
            <Txt
              variant="caption"
              weight="semibold"
              color={finding.rule.severity === 'serious' ? color.roseText : color.inkSoft}
              style={{ letterSpacing: 1, textTransform: 'uppercase' }}
            >
              {finding.rule.severity === 'serious'
                ? t('interactionSerious')
                : t('interactionWatch')}
            </Txt>
            <Txt weight="bold">
              {t('interactionPair', { first: finding.first, second: finding.second })}
            </Txt>
            <Txt variant="body" color={color.ink}>
              {lang === 'ru' ? finding.rule.ru : finding.rule.uz}
            </Txt>
          </View>
        ))
      )}

      {/* Оговорка о неполноте обязательна: молчание проверки — не гарантия. */}
      <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(4) }}>
        {t('interactionNotComplete')}
      </Txt>
      {hasManualEntries ? (
        <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
          {t('interactionManualHint')}
        </Txt>
      ) : null}
    </Card>
  );
}
