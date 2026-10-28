import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ECGLine } from '@/components/motion/ECGLine';
import { Button, Gap, IconButton, Pill } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { cloudConfigured } from '@/features/cloud/client';
import { refreshInviteCode } from '@/features/cloud/sync';
import { getPermissionGranted, rescheduleAll, requestPermission } from '@/features/notifications';
import { useHealth } from '@/hooks/useHealth';
import { useT } from '@/i18n';
import { usePrefs, type Lang } from '@/store/prefs';
import { useMotion } from '@/theme/motion';
import { color, space, type MotionLevel, type TextSize } from '@/theme/tokens';

const LANGS: { value: Lang; label: string }[] = [
  { value: 'uz', label: "O'zbekcha" },
  { value: 'ru', label: 'Русский' },
];

export default function SettingsScreen() {
  const { t } = useT();
  const { prefs, set } = usePrefs();
  const bracelet = useHealth();
  const motion = useMotion();
  const [notifications, setNotifications] = useState<boolean | null>(null);
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  /**
   * Год рождения хранится отдельной строкой, пока его печатают.
   *
   * Если показывать значение прямо из настроек, поле очищается на первой
   * же цифре: год там появляется только когда введены все четыре, а до
   * этого в настройках null — и дописать вторую цифру уже некуда.
   */
  const [birthYearText, setBirthYearText] = useState(
    prefs.birthYear ? String(prefs.birthYear) : '',
  );
  const [inviteBusy, setInviteBusy] = useState(false);

  useEffect(() => {
    getPermissionGranted()
      .then(setNotifications)
      .catch(() => setNotifications(false));
  }, []);

  const sizes: { value: TextSize; label: string }[] = [
    { value: 'normal', label: t('textSizeNormal') },
    { value: 'large', label: t('textSizeLarge') },
    { value: 'huge', label: t('textSizeHuge') },
    { value: 'max', label: t('textSizeMax') },
  ];

  const levels: { value: MotionLevel; label: string }[] = [
    { value: 'full', label: t('motionFull') },
    { value: 'reduced', label: t('motionReduced') },
    { value: 'off', label: t('motionOff') },
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
        <Caption>{t('familyRoleQuestion')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Pill
            label={t('roleIAmPatient')}
            selected={prefs.role === 'patient'}
            onPress={() => set('role', 'patient')}
            tint={color.blushSoft}
          />
          <Pill
            label={t('roleIAmRelative')}
            selected={prefs.role === 'relative'}
            onPress={() => set('role', 'relative')}
            tint={color.blushSoft}
          />
        </View>
      </View>

      {/* Код приглашения нужен только тому, за кем следят. */}
      {prefs.role === 'patient' && cloudConfigured ? (
        <View style={{ gap: space(2) }}>
          <Caption>{t('inviteSection')}</Caption>
          <Card tint={color.blushSoft}>
            <Txt variant="body">{t('shareCodeHint')}</Txt>
            {invite ? (
              <Txt
                variant="display"
                weight="displayExtra"
                align="center"
                style={{ marginTop: space(4), letterSpacing: 6 }}
              >
                {invite.code}
              </Txt>
            ) : null}
            <Gap size={4} />
            <Button
              label={invite ? t('newCode') : t('inviteCode')}
              icon="share"
              busy={inviteBusy}
              onPress={async () => {
                setInviteBusy(true);
                setInvite(await refreshInviteCode());
                setInviteBusy(false);
              }}
            />
          </Card>
        </View>
      ) : null}

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

      <View style={{ gap: space(2) }}>
        <Caption>{t('boldText')}</Caption>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <Pill
            label={t('boldTextOff')}
            selected={!prefs.boldText}
            onPress={() => set('boldText', false)}
            tint={color.peachSoft}
          />
          <Pill
            label={t('boldTextOn')}
            selected={prefs.boldText}
            onPress={() => set('boldText', true)}
            tint={color.peachSoft}
          />
        </View>
      </View>

      <View style={{ gap: space(2) }}>
        <Caption>{t('motion')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {levels.map((item) => (
            <Pill
              key={item.value}
              label={item.label}
              selected={prefs.motion === item.value}
              onPress={() => set('motion', item.value)}
              tint={color.peachSoft}
            />
          ))}
        </View>
        <Txt variant="caption" color={color.inkSoft}>
          {t('motionHint')}
        </Txt>
        {/* Если движение урезал сам телефон, человек должен понимать, почему
            выбранное «полное» не действует. */}
        {motion.level !== prefs.motion ? (
          <Txt variant="caption" color={color.inkSoft}>
            {t('motionSystemHint')}
          </Txt>
        ) : null}
      </View>

      {/*
        Образец. Размер букв, их толщину и движение нельзя выбрать по
        названию ступени — их видно только на живом примере. Поэтому он
        стоит сразу под переключателями: человек меняет настройку и тут же
        видит карточку лекарства такой, какой она будет на главном экране.
      */}
      <Card raised>
        <Caption>{t('appearancePreview')}</Caption>
        <Gap size={3} />
        <Txt variant="title" weight="display">
          Enalapril
        </Txt>
        <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(1) }}>
          08:00 · {t('afterMeal')}
        </Txt>
        <Gap size={2} />
        <ECGLine height={40} />
      </Card>

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
          value={birthYearText}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, '').slice(0, 4);
            setBirthYearText(digits);
            // В настройки год попадает только когда он правдоподобен:
            // иначе возраст в медкарте для врача был бы ерундой.
            const year = Number(digits);
            const current = new Date().getFullYear();
            set('birthYear', digits.length === 4 && year > 1900 && year <= current ? year : null);
          }}
          placeholder="1952"
          keyboardType="number-pad"
          maxLength={4}
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
        <Caption>{t('voice')}</Caption>
        <Button
          label={t('voiceCheck')}
          icon="mic"
          variant="soft"
          onPress={() => router.push('/voice-check')}
        />
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
