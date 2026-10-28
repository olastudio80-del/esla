import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import type { VoiceState } from '@/hooks/useVoiceAsk';
import { useT } from '@/i18n';
import { color, radius, semantic, space } from '@/theme/tokens';

/**
 * Показывает, что происходит с голосом: говорим, слушаем или ждём нажатия.
 *
 * Пожилому человеку нужно видеть, слышат ли его прямо сейчас, —
 * иначе он замолкает и ждёт, а приложение ждёт его.
 */
export function VoiceBar({
  state,
  partial,
  offline,
  onPress,
}: {
  state: VoiceState;
  /** Что распознано прямо сейчас — подтверждение, что его слышат. */
  partial: string;
  offline: boolean;
  onPress: () => void;
}) {
  const { t } = useT();
  const listening = state === 'listening';

  const label = listening
    ? partial || t('assistantListening')
    : state === 'speaking'
      ? t('voiceSpeaking')
      : t('voiceTap');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('voiceTap')}
      accessibilityState={{ busy: state !== 'idle' }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        padding: space(3),
        paddingRight: space(5),
        borderRadius: radius.pill,
        backgroundColor: listening ? semantic.assistant : color.card,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: listening ? color.card : semantic.assistantSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="mic" size={24} color={listening ? color.rose : color.ink} strokeWidth={2.2} />
      </View>

      <View style={{ flex: 1 }}>
        <Txt weight="semibold" numberOfLines={2}>
          {label}
        </Txt>
        <Txt variant="caption" color={color.inkSoft}>
          {offline ? t('voiceOfflineReady') : t('voiceOnlineOnly')}
        </Txt>
      </View>
    </Pressable>
  );
}
