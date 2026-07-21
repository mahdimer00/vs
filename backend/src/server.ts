import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { askOllama } from "./config/ollama.js";
import { runSeed } from "./seed/run.js";
import { startCronJobs } from "./utils/cron.js";

async function warmUpOllama() {
  try {
    await askOllama([{ role: "user", content: "hi" }]);
    console.log("Ollama model warmed up ✅");
  } catch {
    console.warn("Ollama warm-up skipped (model not ready)");
  }
}

async function bootstrap() {
  await connectDatabase();
  await runSeed();
  startCronJobs();
  // Warm up Ollama in background — don't block startup
  void warmUpOllama();
  app.listen(env.PORT, () => {
    console.log(`VisaStore backend listening on ${env.BACKEND_URL}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
