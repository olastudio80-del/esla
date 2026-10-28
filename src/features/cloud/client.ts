import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

/**
 * Подключение к облаку для раздела «Ota-onam».
 *
 * Адрес и публичный ключ приходят из переменных сборки. Если их нет,
 * приложение работает полностью, просто без связи телефонов — поэтому
 * здесь не выбрасывается ошибка, а возвращается null, и каждый вызов
 * обязан это проверить.
 *
 * Публичный ключ не секрет: он лежит в APK и виден любому. Доступ к данным
 * держится на разграничении по строкам в базе, а не на тайне ключа.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && anonKey);

// Тип выводится из настроек: схема здесь esla, а не public.
export const supabase = cloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        // Сессия хранится на телефоне: пожилой человек не должен входить заново.
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Ссылок с токенами в мобильном приложении нет.
        detectSessionInUrl: false,
      },
      db: { schema: 'esla' },
    })
  : null;
