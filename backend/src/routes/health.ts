import { Router, Request, Response } from 'express'
import { migrationManager } from '../db/migrations.js'
import { mistralService } from '../services/mistral.js'
import { embeddingService } from '../services/embeddings.js'
import { logger, createRequestLogger } from '../utils/logger.js'
import { handleApiError } from '../utils/errors.js'

const router = Router()
const log = createRequestLogger('HealthRoutes')

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    log.debug('Health check request', {
      requestId: req.requestId
    })
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
    
    res.json({
      success: true,
      data: health
    })
    
  } catch (error) {
    log.error('Health check failed', {
      requestId: req.requestId
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/health/detailed
 * Detailed health check including all services
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    log.info('Detailed health check request', {
      requestId: req.requestId
    })
    
    const startTime = Date.now()
    
    // Check database health
    const dbHealth = await migrationManager.checkDatabaseHealth()
    
    // Check Mistral API
    let mistralHealth = { connected: false, error: null as string | null }
    try {
      const isConnected = await mistralService.validateConnection()
      mistralHealth.connected = isConnected
    } catch (error) {
      mistralHealth.error = (error as Error).message
    }
    
    // Check embedding service
    let embeddingHealth = { connected: false, error: null as string | null }
    try {
      const testResult = await embeddingService.generateEmbedding('test')
      embeddingHealth.connected = testResult.embedding.length > 0
    } catch (error) {
      embeddingHealth.error = (error as Error).message
    }
    
    const checkTime = Date.now() - startTime
    
    // Determine overall status
    const allHealthy = dbHealth.connected && 
                      dbHealth.pgvectorEnabled && 
                      dbHealth.tablesExist && 
                      mistralHealth.connected && 
                      embeddingHealth.connected
    
    const health = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checkTime,
      services: {
        database: {
          status: dbHealth.connected ? 'healthy' : 'unhealthy',
          connected: dbHealth.connected,
          pgvectorEnabled: dbHealth.pgvectorEnabled,
          tablesExist: dbHealth.tablesExist,
          sampleDataExists: dbHealth.sampleDataExists
        },
        mistral: {
          status: mistralHealth.connected ? 'healthy' : 'unhealthy',
          connected: mistralHealth.connected,
          error: mistralHealth.error
        },
        embeddings: {
          status: embeddingHealth.connected ? 'healthy' : 'unhealthy',
          connected: embeddingHealth.connected,
          error: embeddingHealth.error
        }
      }
    }
    
    log.info('Detailed health check completed', {
      requestId: req.requestId,
      status: health.status,
      checkTime,
      dbConnected: dbHealth.connected,
      mistralConnected: mistralHealth.connected,
      embeddingConnected: embeddingHealth.connected
    })
    
    const statusCode = allHealthy ? 200 : 503
    
    res.status(statusCode).json({
      success: allHealthy,
      data: health
    })
    
  } catch (error) {
    log.error('Detailed health check failed', {
      requestId: req.requestId
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/health/database
 * Database-specific health check
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    log.debug('Database health check request', {
      requestId: req.requestId
    })
    
    const dbHealth = await migrationManager.checkDatabaseHealth()
    
    const health = {
      status: dbHealth.connected && dbHealth.pgvectorEnabled && dbHealth.tablesExist ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      ...dbHealth
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    })
    
  } catch (error) {
    log.error('Database health check failed', {
      requestId: req.requestId
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/health/ai
 * AI services health check
 */
router.get('/ai', async (req: Request, res: Response) => {
  try {
    log.debug('AI services health check request', {
      requestId: req.requestId
    })
    
    const startTime = Date.now()
    
    // Check Mistral API
    let mistralHealth = { connected: false, responseTime: 0, error: null as string | null }
    try {
      const mistralStart = Date.now()
      const isConnected = await mistralService.validateConnection()
      mistralHealth.connected = isConnected
      mistralHealth.responseTime = Date.now() - mistralStart
    } catch (error) {
      mistralHealth.error = (error as Error).message
    }
    
    // Check embedding service
    let embeddingHealth = { connected: false, responseTime: 0, error: null as string | null }
    try {
      const embeddingStart = Date.now()
      const testResult = await embeddingService.generateEmbedding('health check')
      embeddingHealth.connected = testResult.embedding.length > 0
      embeddingHealth.responseTime = Date.now() - embeddingStart
    } catch (error) {
      embeddingHealth.error = (error as Error).message
    }
    
    const totalTime = Date.now() - startTime
    const allHealthy = mistralHealth.connected && embeddingHealth.connected
    
    const health = {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      totalCheckTime: totalTime,
      services: {
        mistral: mistralHealth,
        embeddings: embeddingHealth
      }
    }
    
    const statusCode = allHealthy ? 200 : 503
    
    res.status(statusCode).json({
      success: allHealthy,
      data: health
    })
    
  } catch (error) {
    log.error('AI services health check failed', {
      requestId: req.requestId
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/health/metrics
 * System metrics and statistics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    log.debug('Metrics request', {
      requestId: req.requestId
    })
    
    // Get system metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      environment: process.env.NODE_ENV || 'development'
    }
    
    res.json({
      success: true,
      data: metrics
    })
    
  } catch (error) {
    log.error('Metrics request failed', {
      requestId: req.requestId
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

export { router as healthRoutes }

