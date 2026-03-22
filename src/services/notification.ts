// src/services/notification.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import type { NotificationTriggerInput } from "expo-notifications";
import { useSettings } from "../store/settings";

// Configure how notifications behave when received
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => {
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as Notifications.NotificationBehavior;
  },
});

/**
 * Ask for user permission to show notifications
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn("Must use a physical device for notifications");
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Notification permissions not granted");
    return false;
  }

  console.log("✅ Notification permission granted");
  return true;
}

/**
 * Generic scheduler for notifications
 */
export async function scheduleNotification({
  title,
  body,
  trigger,
}: {
  title: string;
  body: string;
  trigger: NotificationTriggerInput;
}): Promise<string | undefined> {
  const { notificationsEnabled } = useSettings.getState();
  if (!notificationsEnabled) {
    console.log("Notification skipped - app level toggle is OFF");
    return undefined;
  }

  try {
    // Also check OS status real-time
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log("Notification skipped - OS permission not granted");
      return undefined;
    }

    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger,
    });
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return undefined;
  }
}

/**
 * Send an instant weather alert notification
 */
export async function sendWeatherAlert(condition: string) {
  const c = (condition || "").toLowerCase();
  let message = "🌦️ Weather changing — check the app for details.";

  if (c.includes("rain")) message = "☔ Rain expected — carry an umbrella!";
  else if (c.includes("snow")) message = "❄️ Snow incoming — dress warmly!";
  else if (c.includes("clear")) message = "☀️ Clear skies today — lightwear recommended!";
  else if (c.includes("cloud")) message = "⛅ Cloudy — consider a light layer.";

  await scheduleNotification({
    title: "🌦️ Weather Update",
    body: message,
    trigger: null,
  });
}

/**
 * Schedule daily outfit suggestion at 8:00 AM
 */
export async function scheduleDailyOutfitSuggestion() {
  await scheduleNotification({
    title: "👕 Outfit Suggestion",
    body: "Check your wardrobe for today's recommended outfit!",
    trigger: { hour: 8, minute: 0, type: Notifications.SchedulableTriggerInputTypes.DAILY },
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("Cleared scheduled notifications");
  } catch (error) {
    console.error("Error clearing notifications:", error);
  }
}

/**
 * Listen for when a user taps a notification.
 * Returns the subscription (call .remove() on it in cleanup).
 */
export function listenToNotificationResponse(): any {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log("🔔 Notification tapped:", response);
    // optional: navigate user to Notifications screen using your navigation ref
  });
  return sub;
}
