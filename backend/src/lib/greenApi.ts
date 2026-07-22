import { env } from "../config/env";

// Same integration pattern as Awaaz's WhatsApp confirmations
// (docs/04-workflows.md) — a plain REST call to Green API's sendMessage
// endpoint, no SDK. `target` is either a digits-only phone number (built
// into an individual "<phone>@c.us" chat id) or an already-complete Green
// API chat id — an individual "<phone>@c.us" or a group "<id>@g.us" (the
// latter needed to send reminders into a group rather than a 1:1 chat,
// looked up once via Green API's own GetChats endpoint).
export async function sendWhatsAppMessage(target: string, message: string): Promise<void> {
  if (!env.greenApiIdInstance || !env.greenApiTokenInstance) {
    throw new Error("Green API is not configured (GREEN_API_ID_INSTANCE / GREEN_API_TOKEN_INSTANCE)");
  }

  const chatId = target.includes("@") ? target : `${target.replace(/\D/g, "")}@c.us`;
  const url = `https://api.green-api.com/waInstance${env.greenApiIdInstance}/sendMessage/${env.greenApiTokenInstance}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Green API sendMessage failed: ${res.status} ${text}`);
  }
}
