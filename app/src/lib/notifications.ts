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

/** Consulta el permiso REAL actual, sin volver a pedirlo — para que el
 * interruptor de Ajustes muestre el estado de verdad al abrir la app, en vez
 * de resetearse a "apagado" cada vez aunque el permiso siga concedido. */
export async function checkNotifPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** Recordatorio puntual: "Aceite y filtro en 500 km" */
export async function scheduleMaintenanceReminder(title: string, body: string, inDays: number) {
  return Notifications.scheduleNotificationAsync({
    content: { title: `🛡️ ${title}`, body, sound: false },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: inDays * 86_400 },
  });
}

/** Aviso al instante — para los mantenimientos por kilómetros: no se puede
 * "programar una alarma para dentro de X km" (no existe ese trigger), así que
 * esto se dispara de forma reactiva justo cuando el kilometraje real cruza el
 * umbral, en vez de estimar una fecha aproximada. */
export async function sendImmediateReminder(title: string, body: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title: `🛡️ ${title}`, body, sound: false },
    trigger: null, // null = disparo inmediato
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

/** Confirmación al activar notificaciones — nada de ejemplos con datos inventados,
 * solo confirma que ha quedado activado. */
export async function sendNotificationsEnabledConfirmation() {
  return Notifications.scheduleNotificationAsync({
    content: { title: '✅ Notificaciones activadas', body: 'Te avisaré cuando toque revisar algo.', sound: false },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}
