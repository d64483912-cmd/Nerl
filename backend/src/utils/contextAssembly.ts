import { SearchResult } from '../services/vectorSearch.js'
import { logger, createRequestLogger } from './logger.js'

const log = createRequestLogger('ContextAssembly')

export interface AssembledContext {
  contextText: string
  sources: ContextSource[]
  totalTokens: number
  truncated: boolean
}

export interface ContextSource {
  id: string
  title: string
  chapterTitle: string
  pageStart: number
  similarityScore: number
  excerpt: string
}

export interface ContextOptions {
  maxTokens?: number
  maxSources?: number
  includeMetadata?: boolean
  prioritizeRecent?: boolean
  diversityThreshold?: number // Minimum similarity difference to include diverse sources
}

export class ContextAssembler {
  private readonly defaultOptions: Required<ContextOptions> = {
    maxTokens: 3000, // Leave room for prompt and response
    maxSources: 5,
    includeMetadata: true,
    prioritizeRecent: false,
    diversityThreshold: 0.05,
  }
  
  /**
   * Assemble context from search results for LLM prompt
   */
  assembleContext(
    searchResults: SearchResult[],
    query: string,
    options: ContextOptions = {}
  ): AssembledContext {
    const opts = { ...this.defaultOptions, ...options }
    
    log.debug('Assembling context', {
      searchResultsCount: searchResults.length,
      maxTokens: opts.maxTokens,
      maxSources: opts.maxSources
    })
    
    if (searchResults.length === 0) {
      return {
        contextText: '',
        sources: [],
        totalTokens: 0,
        truncated: false
      }
    }
    
    // Filter and rank sources
    const selectedSources = this.selectBestSources(searchResults, query, opts)
    
    // Build context text
    const { contextText, totalTokens, truncated } = this.buildContextText(
      selectedSources,
      opts
    )
    
    // Create source metadata
    const sources = selectedSources.map(result => ({
      id: result.id,
      title: result.title,
      chapterTitle: result.chapterTitle,
      pageStart: result.pageStart,
      similarityScore: result.similarityScore,
      excerpt: this.createExcerpt(result.content, query)
    }))
    
    log.info('Context assembled', {
      sourcesCount: sources.length,
      totalTokens,
      truncated,
      avgSimilarity: sources.reduce((sum, s) => sum + s.similarityScore, 0) / sources.length
    })
    
    return {
      contextText,
      sources,
      totalTokens,
      truncated
    }
  }
  
  /**
   * Select the best sources for context
   */
  private selectBestSources(
    searchResults: SearchResult[],
    query: string,
    options: Required<ContextOptions>
  ): SearchResult[] {
    let candidates = [...searchResults]
    
    // Sort by similarity score
    candidates.sort((a, b) => b.similarityScore - a.similarityScore)
    
    // Apply diversity filtering to avoid too similar sources
    if (options.diversityThreshold > 0) {
      candidates = this.applyDiversityFilter(candidates, options.diversityThreshold)
    }
    
    // Limit to max sources
    candidates = candidates.slice(0, options.maxSources)
    
    log.debug('Selected sources', {
      originalCount: searchResults.length,
      selectedCount: candidates.length,
      topSimilarity: candidates[0]?.similarityScore || 0,
      lowestSimilarity: candidates[candidates.length - 1]?.similarityScore || 0
    })
    
    return candidates
  }
  
  /**
   * Apply diversity filtering to avoid redundant sources
   */
  private applyDiversityFilter(
    sources: SearchResult[],
    threshold: number
  ): SearchResult[] {
    if (sources.length <= 1) return sources
    
    const diverseSources: SearchResult[] = [sources[0]] // Always include the top result
    
    for (let i = 1; i < sources.length; i++) {
      const candidate = sources[i]
      let isDiverse = true
      
      // Check if this source is too similar to already selected sources
      for (const selected of diverseSources) {
        const contentSimilarity = this.calculateContentSimilarity(
          candidate.content,
          selected.content
        )
        
        if (contentSimilarity > (1 - threshold)) {
          isDiverse = false
          break
        }
      }
      
      if (isDiverse) {
        diverseSources.push(candidate)
      }
    }
    
    return diverseSources
  }
  
  /**
   * Calculate content similarity between two texts (simplified)
   */
  private calculateContentSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size // Jaccard similarity
  }
  
  /**
   * Build the context text from selected sources
   */
  private buildContextText(
    sources: SearchResult[],
    options: Required<ContextOptions>
  ): { contextText: string; totalTokens: number; truncated: boolean } {
    const contextParts: string[] = []
    let totalTokens = 0
    let truncated = false
    
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      
      // Create source header
      const header = options.includeMetadata
        ? `\n--- Source ${i + 1}: ${source.title} (${source.chapterTitle}, p. ${source.pageStart}) ---\n`
        : `\n--- Source ${i + 1} ---\n`
      
      const sourceText = header + source.content + '\n'
      const sourceTokens = this.estimateTokens(sourceText)
      
      // Check if adding this source would exceed token limit
      if (totalTokens + sourceTokens > options.maxTokens) {
        // Try to include a truncated version
        const remainingTokens = options.maxTokens - totalTokens - this.estimateTokens(header)
        
        if (remainingTokens > 100) { // Only include if we have reasonable space
          const truncatedContent = this.truncateToTokens(source.content, remainingTokens)
          contextParts.push(header + truncatedContent + '\n[...truncated]')
          totalTokens += this.estimateTokens(header + truncatedContent + '\n[...truncated]')
        }
        
        truncated = true
        break
      }
      
      contextParts.push(sourceText)
      totalTokens += sourceTokens
    }
    
    return {
      contextText: contextParts.join(''),
      totalTokens,
      truncated
    }
  }
  
  /**
   * Create an excerpt from content highlighting query relevance
   */
  private createExcerpt(content: string, query: string, maxLength: number = 200): string {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2)
    
    if (queryWords.length === 0) {
      return content.length > maxLength
        ? content.substring(0, maxLength - 3) + '...'
        : content
    }
    
    // Find the best excerpt that contains query words
    const sentences = content.split(/[.!?]+/)
    let bestExcerpt = ''
    let maxMatches = 0
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      if (sentence.length === 0) continue
      
      const lowerSentence = sentence.toLowerCase()
      const matches = queryWords.filter(word => lowerSentence.includes(word)).length
      
      if (matches > maxMatches) {
        maxMatches = matches
        bestExcerpt = sentence
        
        // Try to include surrounding context
        const prevSentence = i > 0 ? sentences[i - 1].trim() : ''
        const nextSentence = i < sentences.length - 1 ? sentences[i + 1].trim() : ''
        
        const fullExcerpt = [prevSentence, sentence, nextSentence]
          .filter(s => s.length > 0)
          .join('. ')
        
        if (fullExcerpt.length <= maxLength) {
          bestExcerpt = fullExcerpt
        }
      }
    }
    
    if (bestExcerpt.length === 0) {
      bestExcerpt = content
    }
    
    return bestExcerpt.length > maxLength
      ? bestExcerpt.substring(0, maxLength - 3) + '...'
      : bestExcerpt
  }
  
  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4)
  }
  
  /**
   * Truncate text to approximate token count
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4 // Rough conversion
    
    if (text.length <= maxChars) return text
    
    // Try to truncate at sentence boundary
    const truncated = text.substring(0, maxChars)
    const lastSentence = truncated.lastIndexOf('.')
    
    if (lastSentence > maxChars * 0.8) { // If we can keep most of the text
      return truncated.substring(0, lastSentence + 1)
    }
    
    return truncated
  }
  
  /**
   * Format context for different AI models
   */
  formatForModel(
    context: AssembledContext,
    modelType: 'mistral' | 'openai' | 'claude' = 'mistral'
  ): string {
    if (!context.contextText) {
      return 'No relevant context found in the Nelson Textbook of Pediatrics.'
    }
    
    const header = `Based on the following excerpts from the Nelson Textbook of Pediatrics:\n`
    const footer = context.truncated
      ? '\n\n[Note: Context was truncated due to length limits]'
      : ''
    
    return header + context.contextText + footer
  }
}

// Singleton instance
export const contextAssembler = new ContextAssembler()

// Export convenience function
export function assembleContext(
  searchResults: SearchResult[],
  query: string,
  options?: ContextOptions
): AssembledContext {
  return contextAssembler.assembleContext(searchResults, query, options)
}

