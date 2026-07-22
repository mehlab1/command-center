import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export class PushPermissionDeniedError extends Error {}

// Soft opt-in only (docs/06-scheduling-and-notifications.md) — this is
// called from an explicit "enable notifications" tap, never on page load.
// Reuses the existing /sw.js registration rather than a separate
// firebase-messaging-sw.js, so there's one service worker file to reason
// about, not two.
//
// Deliberately lets any other failure (unsupported browser, getToken()
// rejecting) propagate as a real thrown error with its own message rather
// than collapsing everything to null — a silent null here is exactly what
// made the original "failed to register device" report undiagnosable from
// the UI alone.
export async function requestPushToken(): Promise<string> {
  if (typeof window === "undefined" || !(await isSupported())) {
    throw new Error("This browser doesn't support web push notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new PushPermissionDeniedError("Notification permission was denied.");
  }

  const registration = await navigator.serviceWorker.ready;
  const messaging: Messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) {
    throw new Error("Firebase returned no token — the VAPID key or Firebase project config may be mismatched.");
  }
  return token;
}

// Re-derives the same FCM token for an already-granted permission, with no
// permission prompt and no thrown errors — used to restore/refresh the
// "enabled" UI state on mount and to keep the server-side registration
// current, not to drive the initial opt-in flow.
export async function silentlyRefreshPushToken(): Promise<string | null> {
  if (typeof window === "undefined" || Notification.permission !== "granted") return null;
  if (!(await isSupported())) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const messaging: Messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch {
    return null;
  }
}
