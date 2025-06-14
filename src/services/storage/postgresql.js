import net from 'node:net';

async function checkPortIsAlive(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

const db = await (async () => {
  if (
    process.env.POSTGRES_HOST &&
    (await checkPortIsAlive(process.env.POSTGRES_HOST, process.env.POSTGRES_PORT))
  ) {
    const module = await import('./adapters/pg-external.js');
    return module.default;
  }
  const module = await import('./adapters/pglite.js');
  return module.default;
})();
export default db;
