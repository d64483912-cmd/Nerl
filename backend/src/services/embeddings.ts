import { HfInference } from '@huggingface/inference'
import { config } from '../config/index.js'
import { logger, createRequestLogger } from '../utils/logger.js'
import { EmbeddingError } from '../utils/errors.js'

const log = createRequestLogger('EmbeddingService')

// Initialize HuggingFace client
const hf = new HfInference(config.ai.huggingfaceApiKey)

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
  processingTime: number
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  tokenCounts: number[]
  totalProcessingTime: number
  successCount: number
  failureCount: number
}

export class EmbeddingService {
  private readonly model: string
  private readonly maxRetries: number
  private readonly retryDelay: number
  
  constructor() {
    this.model = config.ai.embeddingModel
    this.maxRetries = 3
    this.retryDelay = 1000 // 1 second
  }
  
  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new EmbeddingError('Text cannot be empty')
    }
    
    const startTime = Date.now()
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        log.debug('Generating embedding', {
          model: this.model,
          textLength: text.length,
          attempt
        })
        
        const response = await hf.featureExtraction({
          model: this.model,
          inputs: text,
        })
        
        // Handle different response formats
        let embedding: number[]
        if (Array.isArray(response) && Array.isArray(response[0])) {
          // 2D array format
          embedding = response[0] as number[]
        } else if (Array.isArray(response)) {
          // 1D array format
          embedding = response as number[]
        } else {
          throw new EmbeddingError('Unexpected response format from HuggingFace API')
        }
        
        // Validate embedding dimensions
        if (embedding.length !== config.ai.vectorDimension) {
          throw new EmbeddingError(
            `Expected ${config.ai.vectorDimension} dimensions, got ${embedding.length}`
          )
        }
        
        const processingTime = Date.now() - startTime
        const tokenCount = this.estimateTokenCount(text)
        
        log.info('Embedding generated successfully', {
          textLength: text.length,
          dimensions: embedding.length,
          processingTime,
          tokenCount,
          attempt
        })
        
        return {
          embedding,
          tokenCount,
          processingTime
        }
        
      } catch (error) {
        lastError = error as Error
        
        log.warn('Embedding generation attempt failed', {
          attempt,
          maxRetries: this.maxRetries,
          error: lastError.message
        })
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt)
        }
      }
    }
    
    log.error('Embedding generation failed after all retries', {
      maxRetries: this.maxRetries,
      textLength: text.length
    }, lastError!)
    
    throw new EmbeddingError(
      `Failed to generate embedding after ${this.maxRetries} attempts: ${lastError?.message}`
    )
  }
  
  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    if (!texts || texts.length === 0) {
      throw new EmbeddingError('Texts array cannot be empty')
    }
    
    const startTime = Date.now()
    const embeddings: number[][] = []
    const tokenCounts: number[] = []
    let successCount = 0
    let failureCount = 0
    
    log.info('Starting batch embedding generation', {
      batchSize: texts.length,
      model: this.model
    })
    
    // Process in smaller batches to avoid API limits
    const batchSize = 10
    const batches = this.chunkArray(texts, batchSize)
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      
      log.debug('Processing batch', {
        batchIndex: i + 1,
        totalBatches: batches.length,
        batchSize: batch.length
      })
      
      for (const text of batch) {
        try {
          const result = await this.generateEmbedding(text)
          embeddings.push(result.embedding)
          tokenCounts.push(result.tokenCount)
          successCount++
        } catch (error) {
          log.warn('Failed to generate embedding for text in batch', {
            textLength: text.length,
            error: (error as Error).message
          })
          
          // Add empty embedding to maintain array alignment
          embeddings.push(new Array(config.ai.vectorDimension).fill(0))
          tokenCounts.push(0)
          failureCount++
        }
      }
      
      // Add delay between batches to respect rate limits
      if (i < batches.length - 1) {
        await this.delay(500)
      }
    }
    
    const totalProcessingTime = Date.now() - startTime
    
    log.info('Batch embedding generation completed', {
      totalTexts: texts.length,
      successCount,
      failureCount,
      totalProcessingTime,
      averageTimePerText: Math.round(totalProcessingTime / texts.length)
    })
    
    return {
      embeddings,
      tokenCounts,
      totalProcessingTime,
      successCount,
      failureCount
    }
  }
  
  /**
   * Estimate token count for a text (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4)
  }
  
  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
  
  /**
   * Delay helper for retries and rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Validate embedding vector
   */
  static validateEmbedding(embedding: number[]): boolean {
    if (!Array.isArray(embedding)) return false
    if (embedding.length !== config.ai.vectorDimension) return false
    if (embedding.some(val => typeof val !== 'number' || isNaN(val))) return false
    return true
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length')
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService()

// Export convenience functions
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  return embeddingService.generateEmbedding(text)
}

export async function generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
  return embeddingService.generateBatchEmbeddings(texts)
}

