import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'
import { chatRoutes } from './routes/chat.js'
import { searchRoutes } from './routes/search.js'
import { healthRoutes } from './routes/health.js'
import { migrationManager } from './db/migrations.js'

const app = express()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API server
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Compression
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Body parsing
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Request logging
app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  req.requestId = requestId
  
  logger.info('Request received', {
    requestId,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  })
  
  next()
})

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/search', searchRoutes)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Nelson-GPT Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND'
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  })
})

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    path: req.path,
    method: req.method
  }, error)
  
  const statusCode = (error as any).statusCode || 500
  
  res.status(statusCode).json({
    error: {
      message: config.app.isDevelopment ? error.message : 'Internal server error',
      code: error.constructor.name,
      ...(config.app.isDevelopment && {
        stack: error.stack
      })
    },
    timestamp: new Date().toISOString(),
    path: req.path
  })
})

// Start server
async function startServer() {
  try {
    // Run database migrations in development
    if (config.app.isDevelopment) {
      logger.info('Running database health check...')
      const health = await migrationManager.checkDatabaseHealth()
      
      if (!health.connected) {
        throw new Error('Database connection failed')
      }
      
      if (!health.tablesExist) {
        logger.info('Running database migrations...')
        await migrationManager.runInitialMigration()
      }
      
      if (!health.sampleDataExists) {
        logger.info('Inserting sample data...')
        await migrationManager.insertSampleData()
      }
      
      logger.info('Database initialization completed')
    }
    
    app.listen(config.server.port, () => {
      logger.info('Server started', {
        port: config.server.port,
        environment: config.app.nodeEnv,
        corsOrigin: config.server.corsOrigin
      })
    })
    
  } catch (error) {
    logger.error('Failed to start server', {}, error as Error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  process.exit(0)
})

// Start the server
startServer()

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

