import cors from "cors";
import { env } from "./env.js";

const allowedOrigins = new Set(
  [env.FRONTEND_URL, env.BACKEND_URL]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean),
);

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS origin denied"));
  },
  credentials: true,
});
