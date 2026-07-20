import { prisma } from "../lib/prisma";
import { getMessaging } from "../lib/firebaseAdmin";

export async function registerPushToken(token: string): Promise<void> {
  await prisma.pushToken.upsert({
    where: { token },
    update: {},
    create: { token },
  });
}

export interface PushPayload {
  title: string;
  body: string;
  // Deep-link target for the service worker's notificationclick handler —
  // a relative path like "/tasks" or "/vault".
  url?: string;
}

// Fans out to every registered device (docs/06-scheduling-and-notifications.md
// explicitly treats multi-device as cheap to support even for one user), and
// prunes tokens Firebase reports as no-longer-registered so the token table
// doesn't accumulate dead entries from uninstalled/expired subscriptions.
export async function sendPushToAllDevices(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  const tokens = await prisma.pushToken.findMany({ select: { id: true, token: true } });
  if (tokens.length === 0) return { sent: 0, pruned: 0 };

  const messaging = getMessaging();
  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title: payload.title, body: payload.body },
    data: payload.url ? { url: payload.url } : undefined,
    webpush: payload.url ? { fcmOptions: { link: payload.url } } : undefined,
  });

  const staleIds = response.responses
    .map((r, i) => ({ r, id: tokens[i].id }))
    .filter(({ r }) => !r.success && isUnregisteredError(r.error?.code))
    .map(({ id }) => id);

  if (staleIds.length > 0) {
    await prisma.pushToken.deleteMany({ where: { id: { in: staleIds } } });
  }

  return { sent: response.successCount, pruned: staleIds.length };
}

function isUnregisteredError(code: string | undefined): boolean {
  return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
}
