import { Pool, PoolClient } from 'pg'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { DatabaseError } from '../utils/errors.js'

// Connection pool for database operations
class DatabaseConnection {
  private pool: Pool | null = null
  private isInitialized = false
  
  async initialize() {
    if (this.isInitialized) return
    
    try {
      this.pool = new Pool({
        connectionString: config.database.url,
        ssl: config.app.isProduction ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      })
      
      // Test the connection
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()
      
      this.isInitialized = true
      logger.info('Database connection pool initialized successfully')
      
    } catch (error) {
      logger.error('Failed to initialize database connection', {}, error as Error)
      throw new DatabaseError('Failed to connect to database', error as Error)
    }
  }
  
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      await this.initialize()
    }
    
    try {
      return await this.pool!.connect()
    } catch (error) {
      logger.error('Failed to get database client', {}, error as Error)
      throw new DatabaseError('Failed to get database client', error as Error)
    }
  }
  
  async query(text: string, params?: any[]) {
    const client = await this.getClient()
    try {
      const start = Date.now()
      const result = await client.query(text, params)
      const duration = Date.now() - start
      
      logger.debug('Database query executed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount,
      })
      
      return result
    } catch (error) {
      logger.error('Database query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      }, error as Error)
      throw new DatabaseError('Query execution failed', error as Error)
    } finally {
      client.release()
    }
  }
  
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient()
    
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error('Database transaction failed', {}, error as Error)
      throw new DatabaseError('Transaction failed', error as Error)
    } finally {
      client.release()
    }
  }
  
  async close() {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      this.isInitialized = false
      logger.info('Database connection pool closed')
    }
  }
}

// Singleton instance
export const db = new DatabaseConnection()

// Helper function for simple queries
export async function query(text: string, params?: any[]) {
  return db.query(text, params)
}

// Helper function for transactions
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  return db.transaction(callback)
}

// Initialize connection on module load
if (process.env.NODE_ENV !== 'test') {
  db.initialize().catch(error => {
    logger.error('Failed to initialize database on startup', {}, error)
    if (config.app.isProduction) {
      process.exit(1)
    }
  })
}

