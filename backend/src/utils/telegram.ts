import { env } from "../config/env.js";

export async function sendTelegramMessage(text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      console.error("Telegram notification failed", await response.text());
    }
  } catch (error) {
    console.error("Telegram notification error", error);
  }
}
