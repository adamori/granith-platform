import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { deleteExpiredSessions } from './services/session.js';
import { sweepReenable, purgeDeliveries } from './services/notify/sweep.js';
import { sweepExpireRequests, purgeAccessRequests } from './services/access/sweep.js';

async function main() {
  const config = loadConfig();
  const app = await createApp(config);

  const cleanupInterval = setInterval(async () => {
    try {
      await app.db
        .deleteFrom('opaque_login_state')
        .where('expires_at', '<', new Date())
        .execute();
      await deleteExpiredSessions(app.db);
      await sweepReenable(app.db);
      await purgeDeliveries(app.db);
      await sweepExpireRequests(app.db);
      await purgeAccessRequests(app.db);
    } catch (err) {
      app.log.error(err, 'Periodic cleanup failed');
    }
  }, 60_000);

  const shutdown = async () => {
    app.log.info('Shutting down...');
    clearInterval(cleanupInterval);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
