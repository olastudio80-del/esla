import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Телефоны родителей для кнопки «Позвонить».
 *
 * Хранятся только на устройстве ребёнка и в облако не отправляются: это
 * личный контакт, он не нужен ни нам, ни серверу. На экране кнопка звонка
 * появляется, только если номер сохранён здесь.
 */
const KEY = 'esla.contacts.v1';

type Contacts = Record<string, string>;

async function read(): Promise<Contacts> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Contacts) : {};
  } catch {
    return {};
  }
}

export async function getPhone(patientId: string): Promise<string | null> {
  const all = await read();
  return all[patientId] ?? null;
}

export async function getAllPhones(): Promise<Contacts> {
  return read();
}

export async function setPhone(patientId: string, phone: string | null): Promise<void> {
  const all = await read();
  if (phone?.trim()) all[patientId] = phone.trim();
  else delete all[patientId];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Не сохранился номер — кнопка звонка просто не появится.
  }
}
