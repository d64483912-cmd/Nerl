import { Router, Request, Response } from 'express'
import { query, validationResult } from 'express-validator'
import { vectorSearchService } from '../services/vectorSearch.js'
import { logger, createRequestLogger } from '../utils/logger.js'
import { handleApiError } from '../utils/errors.js'

const router = Router()
const log = createRequestLogger('SearchRoutes')

// Validation middleware
const validateSearchQuery = [
  query('q')
    .isString()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Query must be between 1 and 1000 characters'),
  query('maxResults')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Max results must be between 1 and 50'),
  query('threshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Similarity threshold must be between 0 and 1'),
  query('specialty')
    .optional()
    .isString()
    .withMessage('Medical specialty must be a string'),
  query('contentType')
    .optional()
    .isString()
    .withMessage('Content type must be a string'),
  query('ageGroup')
    .optional()
    .isString()
    .withMessage('Age group must be a string')
]

const validateSuggestionsQuery = [
  query('q')
    .isString()
    .isLength({ min: 3, max: 100 })
    .withMessage('Query must be between 3 and 100 characters')
]

/**
 * GET /api/search
 * Vector similarity search
 */
router.get('/', validateSearchQuery, async (req: Request, res: Response) => {
  try {
    // Check validation results
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: errors.array()
        },
        timestamp: new Date().toISOString()
      })
    }
    
    const {
      q: queryText,
      maxResults = '10',
      threshold = '0.7',
      specialty,
      contentType,
      ageGroup
    } = req.query as Record<string, string>
    
    log.info('Search request received', {
      requestId: req.requestId,
      queryLength: queryText.length,
      maxResults: parseInt(maxResults),
      threshold: parseFloat(threshold),
      hasSpecialty: !!specialty,
      hasContentType: !!contentType,
      hasAgeGroup: !!ageGroup
    })
    
    // Parse filters
    const medicalSpecialty = specialty ? specialty.split(',').map(s => s.trim()) : []
    const contentTypes = contentType ? contentType.split(',').map(s => s.trim()) : []
    const ageGroups = ageGroup ? ageGroup.split(',').map(s => s.trim()) : []
    
    // Perform search
    const startTime = Date.now()
    const results = await vectorSearchService.searchSimilar(queryText, {
      maxResults: parseInt(maxResults),
      similarityThreshold: parseFloat(threshold),
      medicalSpecialty,
      contentType: contentTypes,
      ageGroups,
      includeMetadata: true
    })
    
    const searchTime = Date.now() - startTime
    
    log.info('Search completed', {
      requestId: req.requestId,
      resultsCount: results.length,
      searchTime,
      topSimilarity: results[0]?.similarityScore || 0
    })
    
    res.json({
      success: true,
      data: {
        query: queryText,
        results,
        metadata: {
          count: results.length,
          searchTime,
          filters: {
            medicalSpecialty,
            contentTypes,
            ageGroups,
            similarityThreshold: parseFloat(threshold)
          }
        }
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    log.error('Search request failed', {
      requestId: req.requestId,
      query: req.query.q,
      error: (error as Error).message
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/search/hybrid
 * Hybrid search combining vector similarity and full-text search
 */
router.get('/hybrid', validateSearchQuery, async (req: Request, res: Response) => {
  try {
    // Check validation results
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: errors.array()
        },
        timestamp: new Date().toISOString()
      })
    }
    
    const {
      q: queryText,
      maxResults = '10',
      threshold = '0.7',
      specialty,
      contentType,
      ageGroup
    } = req.query as Record<string, string>
    
    log.info('Hybrid search request received', {
      requestId: req.requestId,
      queryLength: queryText.length,
      maxResults: parseInt(maxResults),
      threshold: parseFloat(threshold)
    })
    
    // Parse filters
    const medicalSpecialty = specialty ? specialty.split(',').map(s => s.trim()) : []
    const contentTypes = contentType ? contentType.split(',').map(s => s.trim()) : []
    const ageGroups = ageGroup ? ageGroup.split(',').map(s => s.trim()) : []
    
    // Perform hybrid search
    const startTime = Date.now()
    const results = await vectorSearchService.hybridSearch(queryText, {
      maxResults: parseInt(maxResults),
      similarityThreshold: parseFloat(threshold),
      medicalSpecialty,
      contentType: contentTypes,
      ageGroups,
      includeMetadata: true
    })
    
    const searchTime = Date.now() - startTime
    
    log.info('Hybrid search completed', {
      requestId: req.requestId,
      resultsCount: results.length,
      searchTime,
      topSimilarity: results[0]?.similarityScore || 0
    })
    
    res.json({
      success: true,
      data: {
        query: queryText,
        results,
        metadata: {
          count: results.length,
          searchTime,
          searchType: 'hybrid',
          filters: {
            medicalSpecialty,
            contentTypes,
            ageGroups,
            similarityThreshold: parseFloat(threshold)
          }
        }
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    log.error('Hybrid search request failed', {
      requestId: req.requestId,
      query: req.query.q,
      error: (error as Error).message
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/search/suggestions
 * Get search suggestions for autocomplete
 */
router.get('/suggestions', validateSuggestionsQuery, async (req: Request, res: Response) => {
  try {
    // Check validation results
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: errors.array()
        },
        timestamp: new Date().toISOString()
      })
    }
    
    const { q: partialQuery } = req.query as { q: string }
    
    log.debug('Search suggestions request', {
      requestId: req.requestId,
      partialQuery
    })
    
    const suggestions = await vectorSearchService.getSearchSuggestions(partialQuery)
    
    res.json({
      success: true,
      data: {
        query: partialQuery,
        suggestions
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    log.error('Search suggestions request failed', {
      requestId: req.requestId,
      query: req.query.q,
      error: (error as Error).message
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/search/filters
 * Get available filter options
 */
router.get('/filters', async (req: Request, res: Response) => {
  try {
    log.debug('Search filters request', {
      requestId: req.requestId
    })
    
    // Return available filter options
    const filters = {
      medicalSpecialties: [
        'general_pediatrics',
        'neonatology',
        'cardiology',
        'pulmonology',
        'gastroenterology',
        'nephrology',
        'endocrinology',
        'hematology_oncology',
        'infectious_diseases',
        'neurology',
        'rheumatology',
        'emergency_medicine',
        'critical_care',
        'developmental_pediatrics',
        'adolescent_medicine'
      ],
      contentTypes: [
        'chapter',
        'section',
        'subsection',
        'table',
        'figure',
        'reference'
      ],
      ageGroups: [
        'neonate',
        'infant',
        'toddler',
        'child',
        'adolescent'
      ]
    }
    
    res.json({
      success: true,
      data: filters,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    log.error('Search filters request failed', {
      requestId: req.requestId,
      error: (error as Error).message
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

export { router as searchRoutes }

