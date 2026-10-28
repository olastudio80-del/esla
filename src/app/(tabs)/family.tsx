import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button, Gap } from '@/components/ui/Button';
import { Caption, Card, SectionTitle } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { dayProgress, type DayProgress } from '@/db/doses';
import { useHealth } from '@/hooks/useHealth';
import { useT } from '@/i18n';
import { formatCount, useAgo, useDuration } from '@/lib/format';
import { color, semantic, space } from '@/theme/tokens';

/**
 * Раздел «Ota-onam» из презентации.
 *
 * Связь двух телефонов требует сервера, поэтому пока здесь показываются
 * собственные показатели и приём лекарств — ровно то, что увидит
 * родственник, когда связь появится. Так видно состав экрана, и ничего
 * выдуманного не показывается.
 */
export default function FamilyScreen() {
  const { t } = useT();
  const bracelet = useHealth();
  const [progress, setProgress] = useState<DayProgress>({ taken: 0, total: 0 });

  useFocusEffect(
    useCallback(() => {
      dayProgress()
        .then(setProgress)
        .catch((error) => console.warn('[esla] не удалось прочитать прогресс дня', error));
      bracelet.refresh();
      // bracelet.refresh стабилен по useCallback внутри хука.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const { heartRate, steps, sleepMinutes } = bracelet.snapshot;
  const ago = useAgo();
  const duration = useDuration();

  return (
    <Screen>
      <SectionTitle title={t('familyTitle')} />

      <View style={{ gap: space(2) }}>
        <Caption>{t('myData')}</Caption>

        <Card tint={color.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Icon name="heart" size={20} color={color.rose} filled />
              <Txt variant="caption" weight="semibold" color={color.inkSoft}>
                {t('heartRate')}
              </Txt>
            </View>
            {heartRate ? (
              <Txt variant="caption" color={color.inkSoft}>
                {ago(heartRate.measuredAt)}
              </Txt>
            ) : null}
          </View>
          <Txt variant="headline" weight="displayExtra" style={{ marginTop: space(2) }}>
            {heartRate ? `${Math.round(heartRate.value)}` : '—'}
            <Txt variant="body" color={color.inkSoft}>
              {heartRate ? ` ${t('bpm')}` : ''}
            </Txt>
          </Txt>
        </Card>

        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <VitalTile
            icon="moon"
            label={t('sleep')}
            value={sleepMinutes ? duration(sleepMinutes.value) : '—'}
            hint={sleepMinutes ? ago(sleepMinutes.measuredAt) : null}
          />
          <VitalTile
            icon="activity"
            label={t('steps')}
            value={steps ? formatCount(steps.value) : '—'}
            hint={steps ? ago(steps.measuredAt) : null}
          />
        </View>

        {!bracelet.checking && !bracelet.hasData ? <BraceletHint /> : null}
      </View>

      <Card tint={color.lilacSoft}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt weight="semibold">{t('todayMedsProgress')}</Txt>
          <Txt variant="subtitle" weight="displayExtra">
            {progress.taken} / {progress.total}
          </Txt>
        </View>
        {progress.total > 0 ? (
          <View
            style={{
              height: 14,
              borderRadius: 7,
              backgroundColor: color.card,
              marginTop: space(3),
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round((progress.taken / progress.total) * 100)}%`,
                height: '100%',
                borderRadius: 7,
                backgroundColor: color.pillSage,
              }}
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <Icon name="users" size={24} color={color.inkSoft} />
          <Txt weight="semibold" style={{ flex: 1 }}>
            {t('familyNeedsAccount')}
          </Txt>
        </View>
        <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
          {t('familyNeedsAccountHint')}
        </Txt>
      </Card>
    </Screen>
  );
}

function VitalTile({
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
    <Card style={{ flex: 1 }} tint={color.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Icon name={icon} size={18} color={color.inkSoft} />
        <Txt variant="caption" weight="semibold" color={color.inkSoft}>
          {label}
        </Txt>
      </View>
      <Txt variant="subtitle" weight="displayExtra" style={{ marginTop: space(2) }}>
        {value}
      </Txt>
      {hint ? (
        <Txt variant="caption" color={color.inkSoft}>
          {hint}
        </Txt>
      ) : null}
    </Card>
  );
}

/** Браслета нет или он молчит — объясняем, что это нормально. */
function BraceletHint() {
  const { t } = useT();
  const bracelet = useHealth();

  const text =
    bracelet.state === 'provider-missing'
      ? t('healthConnectMissingHint')
      : bracelet.state === 'needs-permission'
        ? t('healthConnectPermission')
        : t('healthConnectNoDataHint');

  return (
    <Card tint={semantic.braceletSoft}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Icon name="watch" size={22} color={color.ink} />
        <Txt weight="semibold" style={{ flex: 1 }}>
          {bracelet.state === 'provider-missing'
            ? t('healthConnectMissing')
            : t('braceletNoDataYet')}
        </Txt>
      </View>
      <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
        {text}
      </Txt>
      {bracelet.state === 'needs-permission' ? (
        <>
          <Gap size={3} />
          <Button
            label={t('healthConnectConnect')}
            variant="soft"
            onPress={() => void bracelet.request()}
          />
        </>
      ) : null}
      <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(3) }}>
        {t('braceletWorksWithoutHint')}
      </Txt>
    </Card>
  );
}
