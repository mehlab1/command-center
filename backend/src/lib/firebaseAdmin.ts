import admin from "firebase-admin";
import { env } from "../config/env";

let app: admin.app.App | undefined;

// Lazy init, not at module load — several test suites import modules that
// transitively reach this file without ever calling sendPush, and the real
// service-account JSON isn't set in those environments (same pattern as
// vaultCrypto's lazy getKey()).
function getApp(): admin.app.App {
  if (!app) {
    const serviceAccount = JSON.parse(env.firebaseServiceAccountJson);
    app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return app;
}

export function getMessaging(): admin.messaging.Messaging {
  return getApp().messaging();
}
