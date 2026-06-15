import dotenv from 'dotenv';
import https from 'https';
import app from './app.js';
import { connectDB } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

/**
 * Start server after database connection
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Self-ping to prevent Render free tier sleep (every 14 minutes)
    if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
      setInterval(() => {
        const url = `${process.env.RENDER_EXTERNAL_URL}/api/health`;
        https.get(url, (res) => {
          console.log(`🏓 Keep-alive ping [${new Date().toISOString()}] → ${url} | Status: ${res.statusCode}`);
        }).on('error', (err) => {
          console.error(`❌ Keep-alive ping failed [${new Date().toISOString()}] → ${url} | ${err.message}`);
        });
      }, 14 * 60 * 1000);
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
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
