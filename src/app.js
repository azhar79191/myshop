import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import serviceRequestRoutes from './routes/serviceRequestRoutes.js';
import testimonialRoutes from './routes/testimonialRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();

// Enable ETag support for cache validation
app.set('etag', 'strong')

// Enable ETag support for cache validation
app.set('etag', 'strong')

// Enable compression for all responses
app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// CORS configuration
const allowedOrigins = [
  'https://bismillahspraycenter.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
  maxAge: 86400 // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Disable x-powered-by header for security
app.disable('x-powered-by');

// Set cache headers for static responses
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('/admin')) {
    const path = req.path
    if (path.includes('/categories') || path.includes('/brands/all')) {
      // Categories & brand names — rarely change, cache 1hr client / 6hr CDN
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400')
    } else if (path.includes('/products/featured')) {
      // Featured products — cache 10min client / 30min CDN
      res.set('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600')
    } else if (path.includes('/products')) {
      // Products list — cache 5min client / 15min CDN
      res.set('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800')
    } else if (path.includes('/gallery') || path.includes('/faqs')) {
      // Gallery & FAQs — cache 10min client / 30min CDN
      res.set('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600')
    } else if (path.includes('/testimonials')) {
      // Testimonials — cache 15min client / 1hr CDN
      res.set('Cache-Control', 'public, max-age=900, s-maxage=3600, stale-while-revalidate=7200')
    } else if (path.includes('/brands')) {
      // Full brands list with logos — cache 10min
      res.set('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600')
    } else {
      res.set('Cache-Control', 'public, max-age=60, s-maxage=300')
    }
  }
  next()
})

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Favicon handler (prevent 404 errors)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Root and health routes for UptimeRobot / Render
app.get('/', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bismillah Spray Center API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/testimonials', testimonialRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
