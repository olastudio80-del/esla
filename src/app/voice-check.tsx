import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Gap, IconButton } from '@/components/ui/Button';
import { Caption, Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import {
  LOCALE,
  diagnose,
  downloadOfflineModel,
  listenOnce,
  requestVoicePermission,
  type VoiceDiagnostics,
} from '@/features/voice';
import { useT } from '@/i18n';
import { usePrefs } from '@/store/prefs';
import { color, space } from '@/theme/tokens';

/**
 * Что это за экран.
 *
 * Списки языков у распознавания речи разные у Google и Apple, отличаются
 * от устройства к устройству и меняются со временем. Узбекский есть не
 * везде, а офлайн-пакет к нему — тем более. Предсказать это по модели
 * телефона нельзя, поэтому приложение не гадает, а показывает то, что
 * сообщает сама система: какие языки объявлены, какие скачаны, какие
 * голоса есть и что получается распознать прямо сейчас.
 *
 * По этому экрану сразу видно, заработает голосовой опрос на конкретном
 * телефоне или человеку останутся кнопки.
 */
export default function VoiceCheckScreen() {
  const { t } = useT();
  const { prefs } = usePrefs();
  const [info, setInfo] = useState<VoiceDiagnostics | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    diagnose().then((result) => {
      if (alive) setInfo(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  const has = (list: string[], lang: 'uz' | 'ru') =>
    list.some((item) => item.replace('_', '-').toLowerCase().startsWith(lang));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <IconButton name="left" label={t('back')} onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Txt variant="title" weight="display">
            {t('voiceCheck')}
          </Txt>
          <Txt variant="caption" color={color.inkSoft}>
            {t('voiceCheckHint')}
          </Txt>
        </View>
      </View>

      {!info ? (
        <Txt color={color.inkSoft}>{t('loading')}</Txt>
      ) : (
        <>
          <Card>
            <Row label="Платформа" value={info.platform} />
            <Row label={t('assistantListening')} value={info.available ? 'да' : 'нет'} ok={info.available} />
            {info.service ? <Row label={t('voiceEngine')} value={info.service} /> : null}
            {info.error ? <Row label="Ошибка" value={info.error} ok={false} /> : null}
          </Card>

          {/* Главный ответ: что с узбекским и русским именно здесь. */}
          {(['uz', 'ru'] as const).map((lang) => (
            <Card key={lang} tint={has(info.locales, lang) ? color.sageSoft : color.blushSoft}>
              <Txt variant="bodyLarge" weight="bold">
                {LOCALE[lang]}
              </Txt>
              <Gap size={2} />
              <Row label={t('voiceSupported')} value={yesNo(has(info.locales, lang))} ok={has(info.locales, lang)} />
              <Row
                label={t('voiceInstalled')}
                value={yesNo(has(info.installed, lang))}
                ok={has(info.installed, lang)}
              />
              <Row
                label={t('voice')}
                value={yesNo(info.voices.some((v) => v.language.toLowerCase().startsWith(lang)))}
                ok={info.voices.some((v) => v.language.toLowerCase().startsWith(lang))}
              />
            </Card>
          ))}

          <Button
            label={t('voiceDownloadModel')}
            icon="plus"
            variant="soft"
            busy={downloading}
            onPress={async () => {
              setDownloading(true);
              await downloadOfflineModel(prefs.lang);
              setInfo(await diagnose());
              setDownloading(false);
            }}
          />

          <Card tint={color.lilacSoft}>
            <Txt weight="semibold">{t('voiceTestSay')}</Txt>
            {heard !== null ? (
              <Txt variant="body" style={{ marginTop: space(2) }}>
                {heard ? t('voiceTestResult', { text: heard }) : t('voiceTestNothing')}
              </Txt>
            ) : null}
            <Gap size={3} />
            <Button
              label={t('voiceTap')}
              icon="mic"
              busy={listening}
              onPress={async () => {
                setListening(true);
                setHeard(null);
                await requestVoicePermission();
                // Пробуем так, как будет работать в опросе: офлайн, если пакет есть.
                const result = await listenOnce({
                  lang: prefs.lang,
                  offline: has(info.installed, prefs.lang),
                });
                setHeard(result.ok ? result.text : '');
                setListening(false);
              }}
            />
          </Card>

          <View style={{ gap: space(2) }}>
            <Caption>{t('voiceAllLocales', { n: info.locales.length })}</Caption>
            <Txt variant="caption" color={color.inkSoft}>
              {info.locales.join(', ') || '—'}
            </Txt>
          </View>

          <View style={{ gap: space(2) }}>
            <Caption>{t('voiceInstalled')}</Caption>
            <Txt variant="caption" color={color.inkSoft}>
              {info.installed.join(', ') || '—'}
            </Txt>
          </View>

          <View style={{ gap: space(2) }}>
            <Caption>{t('voiceVoices', { n: info.voices.length })}</Caption>
            <Txt variant="caption" color={color.inkSoft}>
              {info.voices.map((v) => v.language).join(', ') || '—'}
            </Txt>
          </View>
        </>
      )}
    </Screen>
  );
}

const yesNo = (value: boolean) => (value ? 'да' : 'нет');

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: space(3),
        paddingVertical: space(1),
      }}
    >
      <Txt variant="caption" color={color.inkSoft} style={{ flex: 1 }}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), flex: 1 }}>
        {ok !== undefined ? (
          <Icon
            name={ok ? 'check' : 'x'}
            size={16}
            color={ok ? color.sageDeep : color.roseText}
            strokeWidth={2.6}
          />
        ) : null}
        <Txt variant="caption" weight="semibold" style={{ flex: 1 }}>
          {value}
        </Txt>
      </View>
    </View>
  );
}
