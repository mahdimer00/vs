import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { runSeed } from "./seed/run.js";
import { startCronJobs } from "./utils/cron.js";

async function bootstrap() {
  await connectDatabase();
  await runSeed();
  startCronJobs();
  app.listen(env.PORT, () => {
    console.log(`VisaStore backend listening on ${env.BACKEND_URL}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
