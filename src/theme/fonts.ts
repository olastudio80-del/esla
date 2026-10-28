import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { Nunito_900Black } from '@expo-google-fonts/nunito';
import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
} from '@expo-google-fonts/onest';
import { useFonts } from 'expo-font';

/**
 * Шрифты те же, что в презентации: Bricolage Grotesque на заголовки,
 * Onest на текст, Nunito Black на логотип. Грузим ровно нужные начертания —
 * каждое лишнее это вес в APK.
 */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    Nunito_900Black,
  });
  // Ошибку загрузки не превращаем в блокировку: системный шрифт хуже, но
  // приложение с напоминаниями о лекарствах должно открыться в любом случае.
  return loaded || !!error;
}
