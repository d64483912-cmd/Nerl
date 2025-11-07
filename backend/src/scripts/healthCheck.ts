#!/usr/bin/env tsx

import { migrationManager } from '../db/migrations.js'
import { mistralService } from '../services/mistral.js'
import { embeddingService } from '../services/embeddings.js'
import { vectorSearchService } from '../services/vectorSearch.js'
import { logger } from '../utils/logger.js'

interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'warning'
  message: string
  details?: any
  responseTime?: number
}

async function performHealthCheck(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []
  
  // Database Health Check
  try {
    logger.info('Checking database health...')
    const startTime = Date.now()
    const dbHealth = await migrationManager.checkDatabaseHealth()
    const responseTime = Date.now() - startTime
    
    if (dbHealth.connected && dbHealth.pgvectorEnabled && dbHealth.tablesExist) {
      results.push({
        service: 'Database',
        status: 'healthy',
        message: 'Database is fully operational',
        details: dbHealth,
        responseTime
      })
    } else if (dbHealth.connected) {
      results.push({
        service: 'Database',
        status: 'warning',
        message: 'Database connected but not fully configured',
        details: dbHealth,
        responseTime
      })
    } else {
      results.push({
        service: 'Database',
        status: 'unhealthy',
        message: 'Cannot connect to database',
        details: dbHealth,
        responseTime
      })
    }
  } catch (error) {
    results.push({
      service: 'Database',
      status: 'unhealthy',
      message: `Database check failed: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    })
  }
  
  // Mistral API Health Check
  try {
    logger.info('Checking Mistral API health...')
    const startTime = Date.now()
    const isConnected = await mistralService.validateConnection()
    const responseTime = Date.now() - startTime
    
    if (isConnected) {
      results.push({
        service: 'Mistral API',
        status: 'healthy',
        message: 'Mistral API is responding correctly',
        responseTime
      })
    } else {
      results.push({
        service: 'Mistral API',
        status: 'unhealthy',
        message: 'Mistral API validation failed',
        responseTime
      })
    }
  } catch (error) {
    results.push({
      service: 'Mistral API',
      status: 'unhealthy',
      message: `Mistral API check failed: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    })
  }
  
  // Embedding Service Health Check
  try {
    logger.info('Checking embedding service health...')
    const startTime = Date.now()
    const testResult = await embeddingService.generateEmbedding('health check test')
    const responseTime = Date.now() - startTime
    
    if (testResult.embedding.length > 0) {
      results.push({
        service: 'Embedding Service',
        status: 'healthy',
        message: 'Embedding service is generating embeddings correctly',
        details: {
          embeddingDimensions: testResult.embedding.length,
          tokenCount: testResult.tokenCount
        },
        responseTime
      })
    } else {
      results.push({
        service: 'Embedding Service',
        status: 'unhealthy',
        message: 'Embedding service returned empty embedding',
        responseTime
      })
    }
  } catch (error) {
    results.push({
      service: 'Embedding Service',
      status: 'unhealthy',
      message: `Embedding service check failed: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    })
  }
  
  // Vector Search Health Check
  try {
    logger.info('Checking vector search health...')
    const startTime = Date.now()
    const searchResults = await vectorSearchService.searchSimilar('fever in children', {
      maxResults: 3,
      similarityThreshold: 0.5
    })
    const responseTime = Date.now() - startTime
    
    if (searchResults.length > 0) {
      results.push({
        service: 'Vector Search',
        status: 'healthy',
        message: 'Vector search is returning results',
        details: {
          resultsCount: searchResults.length,
          topSimilarity: searchResults[0]?.similarityScore || 0
        },
        responseTime
      })
    } else {
      results.push({
        service: 'Vector Search',
        status: 'warning',
        message: 'Vector search completed but returned no results',
        details: { resultsCount: 0 },
        responseTime
      })
    }
  } catch (error) {
    results.push({
      service: 'Vector Search',
      status: 'unhealthy',
      message: `Vector search check failed: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    })
  }
  
  return results
}

function displayResults(results: HealthCheckResult[]) {
  console.log('\n🏥 Nelson-GPT Backend Health Check Results')
  console.log('=' .repeat(50))
  
  let healthyCount = 0
  let warningCount = 0
  let unhealthyCount = 0
  
  results.forEach((result) => {
    const statusIcon = {
      healthy: '✅',
      warning: '⚠️',
      unhealthy: '❌'
    }[result.status]
    
    const responseTimeStr = result.responseTime ? ` (${result.responseTime}ms)` : ''
    
    console.log(`\n${statusIcon} ${result.service}${responseTimeStr}`)
    console.log(`   ${result.message}`)
    
    if (result.details && Object.keys(result.details).length > 0) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n   ')}`)
    }
    
    switch (result.status) {
      case 'healthy':
        healthyCount++
        break
      case 'warning':
        warningCount++
        break
      case 'unhealthy':
        unhealthyCount++
        break
    }
  })
  
  console.log('\n' + '='.repeat(50))
  console.log(`📊 Summary: ${healthyCount} healthy, ${warningCount} warnings, ${unhealthyCount} unhealthy`)
  
  if (unhealthyCount === 0 && warningCount === 0) {
    console.log('🎉 All systems are healthy!')
    return 0
  } else if (unhealthyCount === 0) {
    console.log('⚠️  Some systems have warnings but are functional')
    return 1
  } else {
    console.log('❌ Some systems are unhealthy and need attention')
    return 2
  }
}

async function runHealthCheck() {
  try {
    logger.info('Starting comprehensive health check...')
    
    const results = await performHealthCheck()
    const exitCode = displayResults(results)
    
    // Output JSON format if requested
    if (process.argv.includes('--json')) {
      console.log('\n📄 JSON Output:')
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        results,
        summary: {
          healthy: results.filter(r => r.status === 'healthy').length,
          warning: results.filter(r => r.status === 'warning').length,
          unhealthy: results.filter(r => r.status === 'unhealthy').length
        }
      }, null, 2))
    }
    
    process.exit(exitCode)
    
  } catch (error) {
    logger.error('Health check failed', {}, error as Error)
    console.error('❌ Health check process failed:', (error as Error).message)
    process.exit(3)
  }
}

// Show usage information
function showUsage() {
  console.log(`
Nelson-GPT Backend Health Check Tool

Usage:
  tsx src/scripts/healthCheck.ts [options]

Options:
  --json     Output results in JSON format
  --help     Show this help message

Exit Codes:
  0    All systems healthy
  1    Some warnings but functional
  2    Some systems unhealthy
  3    Health check process failed

Examples:
  tsx src/scripts/healthCheck.ts           # Run health check
  tsx src/scripts/healthCheck.ts --json    # Output JSON format
`)
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage()
  process.exit(0)
}

// Run health check if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthCheck()
}

export { performHealthCheck, displayResults }

