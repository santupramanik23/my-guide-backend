import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import axios from "axios";
import { fileURLToPath } from 'url';
import path from 'path';

import { connectDB } from "./config/database.js";
import apiRouter from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { limiter } from "./middleware/rateLimiter.js";
import { handleUploadError } from "./middleware/upload.js";
import { initReminderCron } from "./jobs/reminderCron.js";


const __filename = fileURLToPath(import.meta.url);           // current file path
const __dirname  = path.dirname(__filename)



const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

/* ---------- Environment Validation (fail fast) ---------- */
const requiredEnvVars = [
  'MONGO_URL',
  'JWT_ACCESS_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// JWT validation
if (!process.env.JWT_ACCESS_SECRET && !process.env.JWT_SECRET) {
  console.error("❌ JWT secret missing. Set JWT_ACCESS_SECRET or JWT_SECRET in .env");
  process.exit(1);
}

console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`✅ All required environment variables present`);

/* ----------------------------- CORS Configuration ----------------------------- */
const allowlist = [
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  credentials: true,
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return cb(null, true);
    
    // If no allowlist configured, allow all origins (development only)
    if (allowlist.length === 0 && process.env.NODE_ENV !== 'production') {
      return cb(null, true);
    }
    
    // Check if origin is in allowlist
    if (allowlist.includes(origin)) return cb(null, true);
    
    return cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
};

/* ----------------------------- Security Middleware ----------------------------- */
// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
    },
  } : false, // Disable CSP in development
  crossOriginEmbedderPolicy: false, // Needed for Cloudinary
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

app.use(cors(corsOptions));

// Body parsing with limits
app.use(express.json({ 
  limit: "10mb",
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: "10mb",
  parameterLimit: 50
}));

// Request logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Request size monitoring
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests
    if (duration > 2000) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.originalUrl} - ${duration}ms`);
    }
    
    // Log errors
    if (res.statusCode >= 400) {
      console.error(`❌ Error response: ${res.statusCode} - ${req.method} ${req.originalUrl}`);
    }
  });
  
  next();
});

/* ----------------------------- Health Checks ----------------------------- */
app.get("/health", (_req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    service: "my-guide-backend",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
    },
    corsAllowlist: allowlist
  };
  
  res.status(200).json(healthcheck);
});

// Database health check
app.get("/health/db", async (_req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    if (dbState === 1) {
      // Ping the database
      await mongoose.connection.db.admin().ping();
      res.status(200).json({
        status: 'healthy',
        database: states[dbState],
        host: mongoose.connection.host,
        name: mongoose.connection.name
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        database: states[dbState]
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'error',
      error: error.message
    });
  }
});

// Liveness probe for Kubernetes/Docker
app.get("/health/live", (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness probe for Kubernetes/Docker
app.get("/health/ready", async (_req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

/* -------------------------------- API Routes ------------------------------ */
app.use("/api", limiter, apiRouter);

/* ----------------------------- Static Frontend (Production) ----------------------------- */
// Serve static frontend files in production (after building frontend into dist/)
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, "dist");

  // Serve static files
  app.use(express.static(frontendPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get("*", (req, res, next) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

/* ----------------------------- Error Handling ----------------------------- */
// Handle upload errors specifically
app.use(handleUploadError);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

/* ---------------------------- Server Startup ---------------------------- */
const PORT = Number(process.env.PORT || 5000);
let server;

async function start() {
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully');

    // Initialize cron jobs
    initReminderCron();

    // Start server
    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 API base URL: http://localhost:${PORT}/api`);
      console.log(`💚 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 CORS origins: ${allowlist.length ? allowlist.join(', ') : 'all (development mode)'}`);
      
      // Setup keep-alive for production deployment
      setupKeepAlive();
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

/* ----------------------------- Keep-Alive Setup ----------------------------- */
function setupKeepAlive() {
  // Only run keep-alive in production and if we have the external URL
  if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    const pingUrl = `${process.env.RENDER_EXTERNAL_URL}/health`;
    
    console.log(`🔄 Setting up keep-alive ping to: ${pingUrl}`);
    
    const keepAlive = setInterval(async () => {
      try {
        const response = await axios.get(pingUrl, { 
          timeout: 30000,
          headers: {
            'User-Agent': 'KeepAlive-Ping/1.0'
          }
        });
        
        if (response.status === 200) {
          console.log(`[KEEP-ALIVE] ✅ Ping successful - ${new Date().toISOString()}`);
        }
      } catch (error) {
        console.error(`[KEEP-ALIVE] ❌ Ping failed:`, error.message);
      }
    }, 14 * 60 * 1000); // Every 14 minutes
    
    // Clear interval on app termination
    process.on('SIGTERM', () => clearInterval(keepAlive));
    process.on('SIGINT', () => clearInterval(keepAlive));
  }
}

/* ------------------------- Graceful Shutdown --------------------------- */
const gracefulShutdown = async (signal) => {
  console.log(`\n📤 ${signal} received. Initiating graceful shutdown...`);
  
  try {
    // Stop accepting new requests
    if (server) {
      console.log('🔌 Closing HTTP server...');
      await new Promise((resolve) => {
        server.close(resolve);
      });
      console.log('✅ HTTP server closed');
    }
    
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      console.log('🗄️ Closing database connection...');
      await mongoose.connection.close();
      console.log('✅ Database connection closed');
    }
    
    console.log('🎉 Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
start();

export default app;