import type { Response } from "express";

// Connected admin SSE clients
const clients = new Set<Response>();

export function addSseClient(res: Response): void {
  clients.add(res);
  res.on("close", () => clients.delete(res));
}

export function emitOrderUpdate(orderId: string, status: string): void {
  const data = JSON.stringify({ type: "order:status", orderId, status });
  for (const client of clients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
}
