import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './config/env';
import { detectionRoute } from './routes/detection';
import { textQaRoute } from './routes/text-qa';
import { classifyRoute } from './routes/classify';
import { checkMinioConnection } from './services/minio';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*', // Allow Chrome extension to access
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.route('/api/v1/label/detection', detectionRoute);
app.route('/api/v1/label/text-qa', textQaRoute);
app.route('/api/v1/label/classify', classifyRoute);

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: err.message || 'Internal server error',
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not found',
    },
    404
  );
});

// Startup with dependency checks
async function startup() {
  console.log('正在检查依赖服务...');
  await checkMinioConnection();
  console.log(`Starting server on port ${env.port}...`);
}

startup().catch((err) => {
  console.error('❌ 启动失败:', err.message);
  process.exit(1);
});

// Export app for testing
export { app };

export default {
  port: env.port,
  fetch: app.fetch,
};
