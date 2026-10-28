// Конфиг заведён вручную: `expo lint` настраивает его через expo.dev,
// который закрыт сетевой политикой этого окружения.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*'],
  },
  {
    // Плагин TypeScript подключён конфигом Expo только для ts/tsx,
    // поэтому правило объявляем для тех же файлов.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Ложные срабатывания на цепочках реэкспорта: expo-notifications
      // отдаёт AndroidImportance через `export * from './...types'`,
      // и правило не проходит по цепочке. TypeScript проверяет это точнее.
      'import/namespace': 'off',
      // Неиспользуемые импорты в React Native легко остаются после правок
      // и тянут лишний код в бандл.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
