process.env.PORT = '3002';
process.env.VITE_TENANT_ID = 'tenant-modendo-01';
const { startServer } = await import('../server.ts');
await startServer();
