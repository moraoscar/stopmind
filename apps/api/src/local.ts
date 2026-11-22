import { serve } from '@hono/node-server';
import { createApiApp } from './app';

const port = Number(process.env.PORT ?? 4000);
const app = createApiApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\n🚀 StopMind! Secure API corriendo en http://localhost:${info.port}`);
  console.log(`   GET  http://localhost:${info.port}/v1/health`);
  console.log(`   POST http://localhost:${info.port}/v1/validate-round`);
  console.log(`   POST http://localhost:${info.port}/v1/hint\n`);
});
