// Root entrypoint shim so both `node server.js` (Railway V1 default) and `node server/server.js` launch Neora World V2.
import { startServer } from './server/server.js';

const srv = await startServer();
const shutdown = async (sig) => {
  console.log(`\n${sig}: flushing data…`);
  await srv.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
