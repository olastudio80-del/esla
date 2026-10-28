import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useT, useType } from '@/i18n';
import type { TKey } from '@/i18n';
import { usePrefs } from '@/store/prefs';
import { color, font } from '@/theme/tokens';

type TabConfig = { name: string; icon: IconName; label: TKey };

/**
 * Разделы различаются по роли — так в макете проекта.
 *
 * У того, кто принимает лекарства, главный экран — его сегодняшние дозы.
 * У того, кто следит за родителями, главный экран — их состояние: ему
 * незачем открывать приложение ради собственных таблеток, он пришёл
 * посмотреть, принял ли отец своё лекарство.
 */
const PATIENT_TABS: TabConfig[] = [
  { name: 'index', icon: 'home', label: 'tabHome' },
  { name: 'medicines', icon: 'pill', label: 'tabMedicines' },
  { name: 'assistant', icon: 'spark', label: 'tabAssistant' },
  { name: 'history', icon: 'file', label: 'tabHistory' },
];

const RELATIVE_TABS: TabConfig[] = [
  { name: 'family', icon: 'heart', label: 'tabStatus' },
  { name: 'medicines', icon: 'pill', label: 'tabMedicines' },
  { name: 'assistant', icon: 'spark', label: 'tabAssistant' },
  { name: 'history', icon: 'file', label: 'tabCard' },
];

/** Все существующие вкладки — скрытые объявляются с href: null. */
const ALL = ['index', 'medicines', 'assistant', 'history', 'family'];

export default function TabsLayout() {
  const { t } = useT();
  const { prefs } = usePrefs();
  const type = useType();
  // Android 15 и новее рисует приложение под системной навигацией.
  const insets = useSafeAreaInsets();

  const visible = prefs.role === 'relative' ? RELATIVE_TABS : PATIENT_TABS;
  const labelSize = Math.round(type('caption') * 0.8);
  const byName = new Map(visible.map((tab) => [tab.name, tab]));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.rose,
        tabBarInactiveTintColor: color.inkSoft,
        tabBarStyle: {
          backgroundColor: color.card,
          borderTopColor: color.line,
          // Высота с запасом: мишень для нажатия должна быть крупной.
          height: 56 + labelSize * 1.8 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 10 + insets.bottom,
        },
        tabBarLabelStyle: { fontFamily: font.bodySemi, fontSize: labelSize },
      }}
    >
      {/* Порядок объявления задаёт порядок вкладок, поэтому сначала видимые. */}
      {visible.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ color: tint }) => (
              <Icon
                name={tab.icon}
                size={26}
                color={typeof tint === 'string' ? tint : color.inkSoft}
              />
            ),
          }}
        />
      ))}

      {ALL.filter((name) => !byName.has(name)).map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
