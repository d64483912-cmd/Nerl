#!/usr/bin/env tsx

import { migrationManager } from '../db/migrations.js'
import { logger } from '../utils/logger.js'

async function runMigrations() {
  try {
    logger.info('Starting database migration process...')
    
    // Check current database health
    logger.info('Checking database health...')
    const initialHealth = await migrationManager.checkDatabaseHealth()
    
    logger.info('Initial database status:', {
      connected: initialHealth.connected,
      pgvectorEnabled: initialHealth.pgvectorEnabled,
      tablesExist: initialHealth.tablesExist,
      sampleDataExists: initialHealth.sampleDataExists
    })
    
    if (!initialHealth.connected) {
      throw new Error('Cannot connect to database. Please check your DATABASE_URL configuration.')
    }
    
    // Run migrations
    if (!initialHealth.tablesExist) {
      logger.info('Running database schema migration...')
      await migrationManager.runInitialMigration()
      logger.info('✅ Database schema migration completed')
    } else {
      logger.info('✅ Database schema already exists')
    }
    
    // Insert sample data if requested
    const shouldInsertSample = process.argv.includes('--sample') || process.argv.includes('--with-sample')
    
    if (shouldInsertSample && !initialHealth.sampleDataExists) {
      logger.info('Inserting sample data...')
      await migrationManager.insertSampleData()
      logger.info('✅ Sample data inserted')
    } else if (shouldInsertSample && initialHealth.sampleDataExists) {
      logger.info('✅ Sample data already exists')
    }
    
    // Final health check
    logger.info('Performing final health check...')
    const finalHealth = await migrationManager.checkDatabaseHealth()
    
    logger.info('Final database status:', {
      connected: finalHealth.connected,
      pgvectorEnabled: finalHealth.pgvectorEnabled,
      tablesExist: finalHealth.tablesExist,
      sampleDataExists: finalHealth.sampleDataExists
    })
    
    if (finalHealth.connected && finalHealth.pgvectorEnabled && finalHealth.tablesExist) {
      logger.info('🎉 Database migration completed successfully!')
      
      if (finalHealth.sampleDataExists) {
        logger.info('📊 Sample data is available for testing')
      } else {
        logger.info('💡 Run with --sample flag to insert sample data, or use the seed script')
      }
      
    } else {
      throw new Error('Migration completed but database health check failed')
    }
    
  } catch (error) {
    logger.error('Database migration failed', {}, error as Error)
    process.exit(1)
  }
}

// Show usage information
function showUsage() {
  console.log(`
Nelson-GPT Database Migration Tool

Usage:
  tsx src/scripts/migrate.ts [options]

Options:
  --sample, --with-sample    Insert sample data after migration
  --help                     Show this help message

Examples:
  tsx src/scripts/migrate.ts                    # Run migrations only
  tsx src/scripts/migrate.ts --sample           # Run migrations and insert sample data
  tsx src/scripts/migrate.ts --help             # Show help
`)
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage()
  process.exit(0)
}

// Run migrations if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Migration process failed', {}, error)
      process.exit(1)
    })
}

export { runMigrations }

