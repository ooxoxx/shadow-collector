import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './config/env';
import { detectionRoute } from './routes/detection';
import { textQaRoute } from './routes/text-qa';
import { classifyRoute } from './routes/classify';

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

console.log(`Starting server on port ${env.port}...`);

// Export app for testing
export { app };

export default {
  port: env.port,
  fetch: app.fetch,
};
