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

// Soft opt-in only (docs/06-scheduling-and-notifications.md) — this is
// called from an explicit "enable notifications" tap, never on page load.
// Reuses the existing /sw.js registration rather than a separate
// firebase-messaging-sw.js, so there's one service worker file to reason
// about, not two.
export async function requestPushToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;
  const messaging: Messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: registration,
  });
  return token || null;
}
