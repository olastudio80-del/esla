import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useT, useType } from '@/i18n';
import { color, font } from '@/theme/tokens';
import type { TKey } from '@/i18n';

/**
 * Пять разделов из презентации. Подписи обязательны: иконка без слова
 * пожилому человеку мало что говорит, а угадывать он не станет.
 */
const TABS: { name: string; icon: IconName; label: TKey }[] = [
  { name: 'index', icon: 'home', label: 'tabHome' },
  { name: 'medicines', icon: 'pill', label: 'tabMedicines' },
  { name: 'assistant', icon: 'chat', label: 'tabAssistant' },
  { name: 'history', icon: 'file', label: 'tabHistory' },
  { name: 'family', icon: 'users', label: 'tabFamily' },
];

export default function TabsLayout() {
  const { t } = useT();
  const type = useType();
  // Подписи вкладок растут вместе с настройкой размера текста, а высота
  // панели — вместе с ними, иначе подпись обрезается снизу.
  const labelSize = Math.round(type('caption') * 0.8);
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
          height: 56 + labelSize * 1.8,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontFamily: font.bodySemi, fontSize: labelSize },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ color: tint }) => (
              <Icon name={tab.icon} size={26} color={typeof tint === 'string' ? tint : color.inkSoft} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
