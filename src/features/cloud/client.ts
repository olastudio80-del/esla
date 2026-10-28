import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

/**
 * Подключение к облаку для раздела «Ota-onam».
 *
 * ПОЧЕМУ КЛЮЧ ЛЕЖИТ В app.json. Публикуемый ключ Supabase не секрет: он
 * попадает в APK и доступен любому, кто его распакует. Безопасность держится
 * на разграничении доступа к строкам в базе — родственник видит только того
 * пациента, который сам дал ему код приглашения. Прятать этот ключ смысла
 * нет, а хранить рядом с остальной конфигурацией — понятнее.
 *
 * Секретный ключ (service_role) в приложение попадать не должен никогда:
 * он обходит все ограничения доступа.
 *
 * Переменные окружения перекрывают значения из app.json — так удобнее
 * переключаться на свой проект при разработке.
 */
type SupabaseExtra = { url?: string; publishableKey?: string };

const extra = (Constants.expoConfig?.extra?.supabase ?? {}) as SupabaseExtra;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.url;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.publishableKey;

export const cloudConfigured = Boolean(url && publishableKey);

// Тип выводится из настроек: схема здесь esla, а не public.
export const supabase = cloudConfigured
  ? createClient(url as string, publishableKey as string, {
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
