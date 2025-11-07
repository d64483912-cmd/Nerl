import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { query } from './connection.js'
import { logger } from '../utils/logger.js'
import { DatabaseError } from '../utils/errors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Migration management for database schema
export class MigrationManager {
  private async checkPgVectorExtension(): Promise<boolean> {
    try {
      const result = await query(
        "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector')"
      )
      return result.rows[0].exists
    } catch (error) {
      logger.error('Failed to check pgvector extension', {}, error as Error)
      return false
    }
  }
  
  private async enablePgVector(): Promise<void> {
    try {
      await query('CREATE EXTENSION IF NOT EXISTS vector')
      logger.info('pgvector extension enabled successfully')
    } catch (error) {
      logger.error('Failed to enable pgvector extension', {}, error as Error)
      throw new DatabaseError('Could not enable pgvector extension. Ensure you have superuser privileges or the extension is pre-installed.', error as Error)
    }
  }
  
  async runInitialMigration(): Promise<void> {
    try {
      logger.info('Starting database migration...')
      
      // Check if pgvector is available
      const hasVector = await this.checkPgVectorExtension()
      if (!hasVector) {
        logger.info('pgvector extension not found, attempting to enable...')
        await this.enablePgVector()
      } else {
        logger.info('pgvector extension already enabled')
      }
      
      // Read and execute schema file
      const schemaPath = join(__dirname, 'schema.sql')
      const schemaSql = readFileSync(schemaPath, 'utf-8')
      
      // Split by semicolon and execute each statement
      const statements = schemaSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      
      for (const statement of statements) {
        try {
          await query(statement)
        } catch (error) {
          // Log but don't fail on statements that might already exist
          logger.warn('Migration statement warning', {
            statement: statement.substring(0, 100) + '...',
            error: (error as Error).message
          })
        }
      }
      
      logger.info('Database migration completed successfully')
      
    } catch (error) {
      logger.error('Database migration failed', {}, error as Error)
      throw new DatabaseError('Migration failed', error as Error)
    }
  }
  
  async insertSampleData(): Promise<void> {
    try {
      logger.info('Inserting sample data...')
      
      // Check if we already have data
      const result = await query('SELECT COUNT(*) FROM document_chunks')
      const count = parseInt(result.rows[0].count)
      
      if (count > 0) {
        logger.info(`Database already contains ${count} document chunks, skipping sample data insertion`)
        return
      }
      
      // Insert sample data using the stored function
      await query('SELECT insert_sample_content()')
      
      logger.info('Sample data inserted successfully')
      
    } catch (error) {
      logger.error('Failed to insert sample data', {}, error as Error)
      throw new DatabaseError('Sample data insertion failed', error as Error)
    }
  }
  
  async checkDatabaseHealth(): Promise<{
    connected: boolean
    pgvectorEnabled: boolean
    tablesExist: boolean
    sampleDataExists: boolean
  }> {
    try {
      // Test basic connection
      await query('SELECT 1')
      const connected = true
      
      // Check pgvector
      const pgvectorEnabled = await this.checkPgVectorExtension()
      
      // Check if main tables exist
      const tablesResult = await query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name IN ('document_chunks', 'chat_sessions', 'chat_messages')
      `)
      const tablesExist = parseInt(tablesResult.rows[0].count) === 3
      
      // Check if sample data exists
      let sampleDataExists = false
      if (tablesExist) {
        const dataResult = await query('SELECT COUNT(*) FROM document_chunks')
        sampleDataExists = parseInt(dataResult.rows[0].count) > 0
      }
      
      return {
        connected,
        pgvectorEnabled,
        tablesExist,
        sampleDataExists
      }
      
    } catch (error) {
      logger.error('Database health check failed', {}, error as Error)
      return {
        connected: false,
        pgvectorEnabled: false,
        tablesExist: false,
        sampleDataExists: false
      }
    }
  }
}

// Singleton instance
export const migrationManager = new MigrationManager()

