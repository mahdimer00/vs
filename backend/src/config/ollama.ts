import { env } from "./env.js";

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function askOllama(messages: Message[]) {
  const response = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = (await response.json()) as { message?: { content?: string } };
  return payload.message?.content || "";
}
