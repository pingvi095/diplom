import Constants from 'expo-constants';
import * as Device from 'expo-device';

const isExpoGo = 
  Constants.appOwnership === ('expo-go' as any) || 
  Constants.executionEnvironment === 'storeClient';

// Функция для регистрации (удаленные пуши)
export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) {
    console.log('Уведомления отключены для Expo Go');
    return null;
  }

  try {
    const NotificationsModule = await import('expo-notifications');
    const Notifications = NotificationsModule as any;

    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch (error) {
    console.log('Ошибка при инициализации уведомлений:', error);
    return null;
  }
}

// Отправка локального уведомления (работает в Expo Go!)
export async function sendLocalNotification(title: string, body: string) {
  try {
    // Импортируем модуль и приводим его к типу any, чтобы убрать конфликты типов
    const NotificationsModule = await import('expo-notifications');
    const Notifications = NotificationsModule as any;
    
    // Настраиваем поведение
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Вызываем метод отправки
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: true,
      },
      trigger: null, // Отправить немедленно
    });
  } catch (error) {
    console.log('Не удалось отправить локальное уведомление:', error);
  }
}
