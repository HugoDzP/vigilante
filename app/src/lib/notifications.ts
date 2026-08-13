// src/lib/notifications.ts — permisos y recordatorios locales
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

export async function requestNotifPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('maintenance', {
      name: 'Mantenimientos', importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250], lightColor: '#34E8A4',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Recordatorio puntual: "Aceite y filtro en 500 km" */
export async function scheduleMaintenanceReminder(title: string, body: string, inDays: number) {
  return Notifications.scheduleNotificationAsync({
    content: { title: `🛡️ ${title}`, body, sound: false },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: inDays * 86_400 },
  });
}

/** Pregunta periódica de kilometraje cada 2 semanas */
export async function scheduleMileageAsk(carName: string) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '📍 ¿Cuántos km marca el ' + carName + '?',
      body: 'Mantén tus predicciones al día — toca para responder.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 14 * 86_400, repeats: true },
  });
}

/** Demo inmediata para que el usuario vea cómo se verá (Ajustes) */
export async function sendDemoNotification() {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '🛡️ Vigilante',
      body: '🛢️ Aceite y filtro en 500 km. Pide cita en Taller Premier antes del finde.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
}
