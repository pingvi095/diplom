// Уведомления временно отключены.
// Это нужно, чтобы приложение работало в Expo Go SDK 54.
// Для APK уведомления можно будет подключить позже через development build.

export async function registerForPushNotifications(): Promise<string | null> {
  console.log("Уведомления отключены");
  return null;
}

export async function sendLocalNotification(
  title: string,
  body: string,
): Promise<void> {
  console.log("Уведомление не отправлено:", title, body);
}
