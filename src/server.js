import SiteSettings from './models/SiteSettings.js';
import NotificationDelivery from './models/NotificationDelivery.js';
import { startNotificationWorker } from './utils/notifications.js';
import AutomationDelivery from './models/AutomationDelivery.js';
import { startAutomationWorker } from './utils/automations.js';
import WhatsAppReply from './models/WhatsAppReply.js';
import { drainWhatsAppReplies } from './utils/whatsappAutomation.js';
import IntegrationSettings from './models/IntegrationSettings.js';
import { refreshIntegrations } from './utils/integrationSettings.js';
import https from 'https';
import Quote from './models/Quote.js';
import { validateEnvironment } from './config/environment.js';
import app from './app.js';
import { connectDB } from './config/db.js';

/**
 * Start server after database connection
 */
const startServer = async () => {
  try {
    const environment = validateEnvironment();

    // Connect to MongoDB
    await connectDB();
    await IntegrationSettings.init();
    await refreshIntegrations(true);
    // Do not accept quote retries before the unique request identifier index is ready.
    await SiteSettings.init();
    await Quote.init();
    await NotificationDelivery.init();
    await AutomationDelivery.init();
    await WhatsAppReply.init();
    const stopNotificationWorker = startNotificationWorker();
    const stopAutomationWorker = startAutomationWorker();
    let whatsappRunning = false;
    const whatsappTimer = setInterval(async () => {
      if (whatsappRunning) return;
      whatsappRunning = true;
      try {
        await refreshIntegrations();
        await drainWhatsAppReplies();
      } catch {
        console.error('WhatsApp reply queue will retry.');
      } finally {
        whatsappRunning = false;
      }
    }, 30000);
    whatsappTimer.unref();

    // Self-ping to prevent Render free tier sleep (every 14 minutes)
    if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
      setInterval(
        () => {
          const url = `${process.env.RENDER_EXTERNAL_URL}/api/health`;
          https
            .get(url, (res) => {
              console.log(
                `🏓 Keep-alive ping [${new Date().toISOString()}] → ${url} | Status: ${res.statusCode}`,
              );
            })
            .on('error', (err) => {
              console.error(
                `❌ Keep-alive ping failed [${new Date().toISOString()}] → ${url} | ${err.message}`,
              );
            });
        },
        14 * 60 * 1000,
      );
    }

    // Start Express server
    const server = app.listen(environment.port, () => {
      const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${environment.port}`;
      console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`📡 API URL: ${baseUrl}/api`);
      console.log(`🔍 Health Check: ${baseUrl}/api/health\n`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
      console.error('❌ Unhandled Rejection at:', promise);
      console.error('❌ Error:', err);
      console.error('❌ Stack:', err.stack);
      // Don't crash in development, just log
      if (process.env.NODE_ENV === 'production') {
        server.close(() => process.exit(1));
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err.message);
      process.exit(1);
    });

    // Graceful shutdown on SIGTERM
    process.on('SIGTERM', () => {
      stopNotificationWorker();
      stopAutomationWorker();
      clearInterval(whatsappTimer);
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
