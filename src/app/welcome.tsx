import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LogoMark } from '@/components/Logo';
import { Button, Gap } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { useT } from '@/i18n';
import { usePrefs, type Role } from '@/store/prefs';
import { color, radius, space } from '@/theme/tokens';

/**
 * Первый запуск: кто держит этот телефон.
 *
 * От ответа зависит всё остальное — у принимающего лекарства главный экран
 * про его дозы, у следящего за родителями про их состояние. Спросить один
 * раз в начале честнее, чем показать не тот интерфейс и ждать, пока человек
 * сам найдёт переключатель в настройках.
 */
export default function WelcomeScreen() {
  const { t } = useT();
  const { prefs, set } = usePrefs();
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState(prefs.patientName);

  return (
    <Screen
      footer={
        <Button
          label={t('welcomeStart')}
          onPress={() => {
            if (!role) return;
            set('role', role);
            set('patientName', name.trim());
            set('onboarded', true);
            router.replace('/');
          }}
          disabled={!role}
          large
        />
      }
    >
      <View style={{ alignItems: 'center', gap: space(3), marginTop: space(6) }}>
        <LogoMark size={88} />
        <Txt variant="headline" weight="logo" color={color.plum}>
          esla
        </Txt>
        <Txt variant="body" color={color.inkSoft} align="center">
          {t('appTagline')}
        </Txt>
      </View>

      <Gap size={4} />

      <Txt variant="subtitle" weight="display">
        {t('welcomeTitle')}
      </Txt>
      <Txt variant="body" color={color.inkSoft}>
        {t('welcomeHint')}
      </Txt>

      <RoleCard
        icon="pill"
        title={t('roleIAmPatient')}
        selected={role === 'patient'}
        onPress={() => setRole('patient')}
        tint={color.blushSoft}
      />
      <RoleCard
        icon="users"
        title={t('roleIAmRelative')}
        selected={role === 'relative'}
        onPress={() => setRole('relative')}
        tint={color.lilacSoft}
      />

      {role === 'patient' ? (
        <View style={{ gap: space(2) }}>
          <Input
            label={t('welcomeName')}
            value={name}
            onChangeText={setName}
            placeholder="Karim bobo"
            autoCapitalize="words"
          />
          <Txt variant="caption" color={color.inkSoft}>
            {t('welcomeNameHint')}
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}

function RoleCard({
  icon,
  title,
  selected,
  onPress,
  tint,
}: {
  icon: 'pill' | 'users';
  title: string;
  selected: boolean;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <Card tint={selected ? color.ink : tint}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.md,
              backgroundColor: color.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={26} color={color.ink} />
          </View>
          <Txt
            variant="bodyLarge"
            weight="bold"
            color={selected ? color.card : color.ink}
            style={{ flex: 1 }}
          >
            {title}
          </Txt>
          {selected ? <Icon name="check" size={24} color={color.card} strokeWidth={3} /> : null}
        </View>
      </Card>
    </Pressable>
  );
}
