import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, Share, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Button, Gap, Pill } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import {
  getTelegramDetails,
  listSubscribers,
  notifyRelatives,
  refreshTelegramLink,
  removeSubscriber,
  setTelegramDetails,
  type TelegramLink,
  type TelegramSubscriber,
} from '@/features/cloud/telegram';
import { useT } from '@/i18n';
import { usePrefs } from '@/store/prefs';
import { color, radius, space } from '@/theme/tokens';

/**
 * Настройка уведомлений близким.
 *
 * Весь раздел — про одно действие: получить ссылку и отправить её близкому.
 * Поэтому ссылка здесь крупная и с одной кнопкой «отправить», а код под ней
 * нужен только на тот случай, когда ссылка почему-то не открывается.
 */
export function TelegramCard() {
  const { t } = useT();
  const { prefs } = usePrefs();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [subscribers, setSubscribers] = useState<TelegramSubscriber[]>([]);
  const [details, setDetails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const reload = useCallback(() => {
    void listSubscribers().then(setSubscribers);
    void getTelegramDetails().then(setDetails);
  }, []);

  // Перечитываем при возврате на экран: близкий мог нажать «Start», пока
  // человек держал настройки открытыми.
  useFocusEffect(reload);

  async function createLink() {
    setBusy(true);
    setLink(await refreshTelegramLink());
    setBusy(false);
  }

  async function sendTest() {
    setTesting(true);
    const sent = await notifyRelatives({ symptoms: [], lang: prefs.lang, test: true });
    setTesting(false);
    Alert.alert(
      sent === null
        ? t('telegramTestFailed')
        : sent === 0
          ? t('telegramTestNobody')
          : t('telegramTestSent', { count: String(sent) }),
    );
    reload();
  }

  function confirmRemove(subscriber: TelegramSubscriber) {
    const name = subscriber.title ?? t('telegramSomeone');
    Alert.alert(t('telegramRemoveConfirm', { name }), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('telegramRemove'),
        style: 'destructive',
        onPress: async () => {
          await removeSubscriber(subscriber.id);
          reload();
        },
      },
    ]);
  }

  return (
    <View style={{ gap: space(2) }}>
      <Caption>{t('telegramSection')}</Caption>

      <Card tint={color.skySoft}>
        <Txt variant="body">{t('telegramHint')}</Txt>

        {link ? (
          <>
            <Gap size={4} />
            {link.url ? (
              <>
                {/* Ссылку показываем целиком: человек часто диктует её по
                    телефону, и обрезанный хвост делает диктовку бесполезной. */}
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(link.url as string)}
                  style={{
                    padding: space(3),
                    borderRadius: radius.md,
                    backgroundColor: color.card,
                  }}
                >
                  <Txt variant="caption" weight="semibold" color={color.plum}>
                    {link.url}
                  </Txt>
                </Pressable>
                <Gap size={3} />
                <Button
                  label={t('telegramShareLink')}
                  icon="share"
                  onPress={() => void Share.share({ message: link.url as string })}
                />
                <Txt variant="caption" color={color.inkSoft} style={{ marginTop: space(2) }}>
                  {t('telegramLinkHint')}
                </Txt>
              </>
            ) : (
              <Txt variant="caption" color={color.roseText}>
                {t('telegramNotReady')}
              </Txt>
            )}

            {/* Код — запас на случай, когда ссылка не открывается:
                его можно продиктовать по телефону. */}
            <Txt
              variant="subtitle"
              weight="displayExtra"
              align="center"
              style={{ marginTop: space(4), letterSpacing: 6 }}
            >
              {link.code}
            </Txt>
            <Txt variant="caption" color={color.inkSoft} align="center">
              {t('telegramCodeHint')}
            </Txt>
          </>
        ) : null}

        <Gap size={4} />
        <Button
          label={link ? t('telegramNewLink') : t('telegramGetLink')}
          icon="plus"
          variant={link ? 'soft' : 'primary'}
          busy={busy}
          onPress={() => void createLink()}
        />
      </Card>

      <Card>
        <Caption>{t('telegramSubscribers')}</Caption>
        <Gap size={2} />
        {subscribers.length === 0 ? (
          <Txt variant="body" color={color.inkSoft}>
            {t('telegramNoSubscribers')}
          </Txt>
        ) : (
          <View style={{ gap: space(2) }}>
            {subscribers.map((subscriber) => (
              <View
                key={subscriber.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}
              >
                <Icon name="users" size={20} color={color.inkSoft} />
                <Txt weight="semibold" style={{ flex: 1 }} numberOfLines={2}>
                  {subscriber.title ?? t('telegramSomeone')}
                </Txt>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('telegramRemove')}
                  onPress={() => confirmRemove(subscriber)}
                  style={{ padding: space(2) }}
                >
                  <Txt variant="caption" weight="semibold" color={color.roseText}>
                    {t('telegramRemove')}
                  </Txt>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Gap size={4} />
        <Button
          label={t('telegramTest')}
          icon="bell"
          variant="soft"
          busy={testing}
          onPress={() => void sendTest()}
        />
      </Card>

      <View style={{ gap: space(2) }}>
        <Caption>{t('telegramDetails')}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Pill
            label={t('telegramDetailsOn')}
            selected={details}
            onPress={() => {
              setDetails(true);
              void setTelegramDetails(true);
            }}
            tint={color.skySoft}
          />
          <Pill
            label={t('telegramDetailsOff')}
            selected={!details}
            onPress={() => {
              setDetails(false);
              void setTelegramDetails(false);
            }}
            tint={color.skySoft}
          />
        </View>
        <Txt variant="caption" color={color.inkSoft}>
          {t('telegramDetailsHint')}
        </Txt>
      </View>
    </View>
  );
}
