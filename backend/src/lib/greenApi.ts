import { env } from "../config/env";

// Same integration pattern as Awaaz's WhatsApp confirmations
// (docs/04-workflows.md) — a plain REST call to Green API's sendMessage
// endpoint, no SDK. chatId is "<digits-only phone, with country code>@c.us".
export async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<void> {
  if (!env.greenApiIdInstance || !env.greenApiTokenInstance) {
    throw new Error("Green API is not configured (GREEN_API_ID_INSTANCE / GREEN_API_TOKEN_INSTANCE)");
  }

  const chatId = `${phoneNumber.replace(/\D/g, "")}@c.us`;
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
