import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Gap, IconButton, Pill } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { getPermissionGranted, rescheduleAll, requestPermission } from '@/features/notifications';
import { useHealth } from '@/hooks/useHealth';
import { useT } from '@/i18n';
import { usePrefs, type Lang } from '@/store/prefs';
import { color, space, type TextSize } from '@/theme/tokens';

const LANGS: { value: Lang; label: string }[] = [
  { value: 'uz', label: "O'zbekcha" },
  { value: 'ru', label: 'Русский' },
];

export default function SettingsScreen() {
  const { t } = useT();
  const { prefs, set } = usePrefs();
  const bracelet = useHealth();
  const [notifications, setNotifications] = useState<boolean | null>(null);

  useEffect(() => {
    getPermissionGranted()
      .then(setNotifications)
      .catch(() => setNotifications(false));
  }, []);

  const sizes: { value: TextSize; label: string }[] = [
    { value: 'normal', label: t('textSizeNormal') },
    { value: 'large', label: t('textSizeLarge') },
    { value: 'huge', label: t('textSizeHuge') },
  ];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <IconButton name="left" label={t('back')} onPress={() => router.back()} />
        <Txt variant="title" weight="display" style={{ flex: 1 }}>
          {t('settings')}
        </Txt>
      </View>

      <View style={{ gap: space(2) }}>
        <Caption>{t('language')}</Caption>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          {LANGS.map((item) => (
            <Pill
              key={item.value}
              label={item.label}
              selected={prefs.lang === item.value}
              onPress={() => {
                set('lang', item.value);
                // Текст уведомлений уже стоит в системе на старом языке —
                // пересобираем расписание, иначе напоминания останутся
                // на языке, который человек только что сменил.
                void rescheduleAll(item.value);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space(2) }}>
        <Caption>{t('textSize')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {sizes.map((item) => (
            <Pill
              key={item.value}
              label={item.label}
              selected={prefs.textSize === item.value}
              onPress={() => set('textSize', item.value)}
              tint={color.peachSoft}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space(3) }}>
        <Caption>{t('profile')}</Caption>
        <Input
          label={t('name')}
          value={prefs.patientName}
          onChangeText={(value) => set('patientName', value)}
          placeholder="Karim bobo"
          autoCapitalize="words"
        />
        <Input
          label={t('birthYear')}
          value={prefs.birthYear ? String(prefs.birthYear) : ''}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, '').slice(0, 4);
            const year = Number(digits);
            // Правдоподобный год рождения: иначе возраст в медкарте был бы ерундой.
            const current = new Date().getFullYear();
            set('birthYear', digits.length === 4 && year > 1900 && year <= current ? year : null);
          }}
          placeholder="1952"
          keyboardType="number-pad"
        />
      </View>

      <View style={{ gap: space(2) }}>
        <Caption>{t('notifications')}</Caption>
        <Card tint={notifications === false ? color.blushSoft : color.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name="bell" size={22} color={notifications ? color.sageDeep : color.rose} />
            <Txt weight="semibold" style={{ flex: 1 }}>
              {notifications ? t('notificationsOn') : t('notificationsOff')}
            </Txt>
          </View>
          {notifications === false ? (
            <>
              <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
                {t('notificationsDeniedHint')}
              </Txt>
              <Gap size={3} />
              <Button
                label={t('notificationsAsk')}
                variant="soft"
                onPress={async () => {
                  const granted = await requestPermission();
                  setNotifications(granted);
                  if (granted) await rescheduleAll(prefs.lang);
                }}
              />
            </>
          ) : null}
        </Card>
      </View>

      <View style={{ gap: space(2) }}>
        <Caption>{t('braceletTitle')}</Caption>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name="watch" size={22} color={color.ink} />
            <Txt weight="semibold" style={{ flex: 1 }}>
              {bracelet.state === 'ready' && bracelet.hasData
                ? t('braceletConnected')
                : bracelet.state === 'provider-missing'
                  ? t('healthConnectMissing')
                  : bracelet.state === 'needs-permission'
                    ? t('healthConnectPermission')
                    : t('braceletOff')}
            </Txt>
          </View>
          <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
            {bracelet.state === 'provider-missing'
              ? t('healthConnectMissingHint')
              : t('braceletWorksWithoutHint')}
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
          {bracelet.state === 'ready' ? (
            <>
              <Gap size={3} />
              <Button label={t('syncNow')} variant="soft" onPress={() => void bracelet.refresh()} />
            </>
          ) : null}
        </Card>
      </View>

      <View style={{ gap: space(2) }}>
        <Caption>{t('about')}</Caption>
        <Card tint={color.app}>
          <Txt variant="body">{t('aboutText')}</Txt>
        </Card>
      </View>
    </Screen>
  );
}
