import { query } from '../db/connection.js'
import { generateEmbedding } from './embeddings.js'
import { logger, createRequestLogger } from '../utils/logger.js'
import { DatabaseError, ValidationError } from '../utils/errors.js'

const log = createRequestLogger('VectorSearch')

export interface SearchResult {
  id: string
  title: string
  content: string
  chapterTitle: string
  pageStart: number
  similarityScore: number
  medicalSpecialty: string[]
  keywords: string[]
  ageGroups: string[]
}

export interface SearchOptions {
  maxResults?: number
  similarityThreshold?: number
  medicalSpecialty?: string[]
  contentType?: string[]
  ageGroups?: string[]
  includeMetadata?: boolean
}

export interface SearchAnalytics {
  queryText: string
  resultsCount: number
  topSimilarityScore: number
  searchTimeMs: number
  embeddingTimeMs: number
}

export class VectorSearchService {
  private readonly defaultOptions: Required<SearchOptions> = {
    maxResults: 10,
    similarityThreshold: 0.7,
    medicalSpecialty: [],
    contentType: [],
    ageGroups: [],
    includeMetadata: true,
  }
  
  /**
   * Search for similar content using vector similarity
   */
  async searchSimilar(
    queryText: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!queryText || queryText.trim().length === 0) {
      throw new ValidationError('Query text cannot be empty')
    }
    
    const opts = { ...this.defaultOptions, ...options }
    const startTime = Date.now()
    
    log.info('Starting vector search', {
      queryLength: queryText.length,
      maxResults: opts.maxResults,
      similarityThreshold: opts.similarityThreshold,
      filters: {
        medicalSpecialty: opts.medicalSpecialty,
        contentType: opts.contentType,
        ageGroups: opts.ageGroups,
      }
    })
    
    try {
      // Generate embedding for query
      const embeddingStartTime = Date.now()
      const { embedding } = await generateEmbedding(queryText)
      const embeddingTimeMs = Date.now() - embeddingStartTime
      
      log.debug('Query embedding generated', {
        embeddingTimeMs,
        dimensions: embedding.length
      })
      
      // Perform vector search
      const searchStartTime = Date.now()
      const results = await this.performVectorSearch(embedding, opts)
      const searchTimeMs = Date.now() - searchStartTime
      
      const totalTimeMs = Date.now() - startTime
      
      log.info('Vector search completed', {
        resultsCount: results.length,
        embeddingTimeMs,
        searchTimeMs,
        totalTimeMs,
        topScore: results.length > 0 ? results[0].similarityScore : 0
      })
      
      // Store analytics (optional)
      await this.storeSearchAnalytics({
        queryText,
        resultsCount: results.length,
        topSimilarityScore: results.length > 0 ? results[0].similarityScore : 0,
        searchTimeMs: totalTimeMs,
        embeddingTimeMs
      })
      
      return results
      
    } catch (error) {
      log.error('Vector search failed', {
        queryLength: queryText.length,
        error: (error as Error).message
      }, error as Error)
      
      throw error
    }
  }
  
  /**
   * Perform the actual vector search query
   */
  private async performVectorSearch(
    queryEmbedding: number[],
    options: Required<SearchOptions>
  ): Promise<SearchResult[]> {
    try {
      // Convert embedding to PostgreSQL vector format
      const embeddingStr = `[${queryEmbedding.join(',')}]`
      
      // Build the query with filters
      let sqlQuery = `
        SELECT 
          id,
          title,
          content,
          chapter_title,
          page_start,
          medical_specialty,
          keywords,
          age_groups,
          (1 - (embedding <=> $1::vector)) as similarity_score
        FROM document_chunks
        WHERE (1 - (embedding <=> $1::vector)) >= $2
      `
      
      const params: any[] = [embeddingStr, options.similarityThreshold]
      let paramIndex = 3
      
      // Add specialty filter
      if (options.medicalSpecialty.length > 0) {
        sqlQuery += ` AND medical_specialty && $${paramIndex}::medical_specialty[]`
        params.push(options.medicalSpecialty)
        paramIndex++
      }
      
      // Add content type filter
      if (options.contentType.length > 0) {
        sqlQuery += ` AND content_type = ANY($${paramIndex}::content_type[])`
        params.push(options.contentType)
        paramIndex++
      }
      
      // Add age group filter
      if (options.ageGroups.length > 0) {
        sqlQuery += ` AND age_groups && $${paramIndex}::text[]`
        params.push(options.ageGroups)
        paramIndex++
      }
      
      // Order by similarity and limit results
      sqlQuery += `
        ORDER BY embedding <=> $1::vector
        LIMIT $${paramIndex}
      `
      params.push(options.maxResults)
      
      log.debug('Executing vector search query', {
        paramCount: params.length,
        maxResults: options.maxResults,
        similarityThreshold: options.similarityThreshold
      })
      
      const result = await query(sqlQuery, params)
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        chapterTitle: row.chapter_title,
        pageStart: row.page_start,
        similarityScore: parseFloat(row.similarity_score),
        medicalSpecialty: row.medical_specialty || [],
        keywords: row.keywords || [],
        ageGroups: row.age_groups || [],
      }))
      
    } catch (error) {
      log.error('Vector search query failed', {}, error as Error)
      throw new DatabaseError('Vector search query execution failed', error as Error)
    }
  }
  
  /**
   * Hybrid search combining vector similarity and full-text search
   */
  async hybridSearch(
    queryText: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const opts = { ...this.defaultOptions, ...options }
    
    log.info('Starting hybrid search', {
      queryLength: queryText.length,
      maxResults: opts.maxResults
    })
    
    try {
      // Get vector search results
      const vectorResults = await this.searchSimilar(queryText, {
        ...opts,
        maxResults: Math.ceil(opts.maxResults * 1.5) // Get more results for reranking
      })
      
      // Get full-text search results
      const textResults = await this.fullTextSearch(queryText, opts)
      
      // Combine and rerank results
      const combinedResults = this.combineSearchResults(vectorResults, textResults)
      
      // Return top results
      return combinedResults.slice(0, opts.maxResults)
      
    } catch (error) {
      log.error('Hybrid search failed', {}, error as Error)
      throw error
    }
  }
  
  /**
   * Full-text search using PostgreSQL's built-in search
   */
  private async fullTextSearch(
    queryText: string,
    options: Required<SearchOptions>
  ): Promise<SearchResult[]> {
    try {
      let sqlQuery = `
        SELECT 
          id,
          title,
          content,
          chapter_title,
          page_start,
          medical_specialty,
          keywords,
          age_groups,
          ts_rank(search_vector, plainto_tsquery('english', $1)) as similarity_score
        FROM document_chunks
        WHERE search_vector @@ plainto_tsquery('english', $1)
      `
      
      const params: any[] = [queryText]
      let paramIndex = 2
      
      // Add filters (similar to vector search)
      if (options.medicalSpecialty.length > 0) {
        sqlQuery += ` AND medical_specialty && $${paramIndex}::medical_specialty[]`
        params.push(options.medicalSpecialty)
        paramIndex++
      }
      
      sqlQuery += `
        ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
        LIMIT $${paramIndex}
      `
      params.push(options.maxResults)
      
      const result = await query(sqlQuery, params)
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        chapterTitle: row.chapter_title,
        pageStart: row.page_start,
        similarityScore: parseFloat(row.similarity_score),
        medicalSpecialty: row.medical_specialty || [],
        keywords: row.keywords || [],
        ageGroups: row.age_groups || [],
      }))
      
    } catch (error) {
      log.error('Full-text search failed', {}, error as Error)
      throw new DatabaseError('Full-text search execution failed', error as Error)
    }
  }
  
  /**
   * Combine and rerank search results from different methods
   */
  private combineSearchResults(
    vectorResults: SearchResult[],
    textResults: SearchResult[]
  ): SearchResult[] {
    const resultMap = new Map<string, SearchResult>()
    
    // Add vector results with higher weight
    vectorResults.forEach(result => {
      resultMap.set(result.id, {
        ...result,
        similarityScore: result.similarityScore * 0.7 // Weight vector similarity
      })
    })
    
    // Add or boost text results
    textResults.forEach(result => {
      const existing = resultMap.get(result.id)
      if (existing) {
        // Boost score for items found in both searches
        existing.similarityScore += result.similarityScore * 0.3
      } else {
        resultMap.set(result.id, {
          ...result,
          similarityScore: result.similarityScore * 0.3 // Lower weight for text-only
        })
      }
    })
    
    // Sort by combined score
    return Array.from(resultMap.values())
      .sort((a, b) => b.similarityScore - a.similarityScore)
  }
  
  /**
   * Store search analytics for improving search quality
   */
  private async storeSearchAnalytics(analytics: SearchAnalytics): Promise<void> {
    try {
      await query(`
        INSERT INTO search_analytics (
          query_text,
          results_count,
          top_similarity_score,
          search_time_ms,
          embedding_time_ms
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        analytics.queryText,
        analytics.resultsCount,
        analytics.topSimilarityScore,
        analytics.searchTimeMs,
        analytics.embeddingTimeMs
      ])
    } catch (error) {
      // Don't fail the search if analytics storage fails
      log.warn('Failed to store search analytics', {
        error: (error as Error).message
      })
    }
  }
  
  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(partialQuery: string): Promise<string[]> {
    if (partialQuery.length < 3) return []
    
    try {
      const result = await query(`
        SELECT DISTINCT title
        FROM document_chunks
        WHERE title ILIKE $1
        ORDER BY title
        LIMIT 10
      `, [`%${partialQuery}%`])
      
      return result.rows.map(row => row.title)
      
    } catch (error) {
      log.warn('Failed to get search suggestions', {}, error as Error)
      return []
    }
  }
}

// Singleton instance
export const vectorSearchService = new VectorSearchService()

// Export convenience functions
export async function searchSimilar(
  queryText: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  return vectorSearchService.searchSimilar(queryText, options)
}

export async function hybridSearch(
  queryText: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  return vectorSearchService.hybridSearch(queryText, options)
}

