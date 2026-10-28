const fs = require('fs');
const path = require('path');

/**
 * Динамическая часть настроек приложения.
 *
 * Нужна ровно для одного: файлы Firebase подключаются, только если они
 * лежат в репозитории. Прописать их прямо в app.json нельзя — prebuild
 * падает, если указанного файла нет, и сборка APK ломалась бы у всех, кто
 * клонировал проект без своего Firebase.
 *
 * Эти файлы не секрет: в них идентификаторы проекта и ключ, ограниченный
 * приложением. Секрет — сервисный ключ для отправки, и он живёт в
 * секретах Edge Functions, а в приложение не попадает.
 */
const ANDROID_FILE = './google-services.json';
const IOS_FILE = './GoogleService-Info.plist';

const present = (file) => fs.existsSync(path.join(__dirname, file));

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(present(ANDROID_FILE) ? { googleServicesFile: ANDROID_FILE } : {}),
  },
  ios: {
    ...config.ios,
    ...(present(IOS_FILE) ? { googleServicesFile: IOS_FILE } : {}),
  },
});
