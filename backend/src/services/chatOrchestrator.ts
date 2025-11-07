import { v4 as uuidv4 } from 'uuid'
import { query, transaction } from '../db/connection.js'
import { vectorSearchService } from './vectorSearch.js'
import { mistralService, ChatMessage, StreamingChunk } from './mistral.js'
import { assembleContext } from '../utils/contextAssembly.js'
import { buildSystemPrompt, buildUserPrompt, medicalPromptBuilder } from '../prompts/medical.js'
import { logger, createRequestLogger } from '../utils/logger.js'
import { DatabaseError, ValidationError } from '../utils/errors.js'

const log = createRequestLogger('ChatOrchestrator')

export interface ChatRequest {
  message: string
  sessionId?: string
  mode: 'academic' | 'clinical'
  userId?: string
  sessionToken?: string
}

export interface ChatResponse {
  sessionId: string
  messageId: string
  response: string
  sources: Array<{
    id: string
    title: string
    chapterTitle: string
    pageStart: number
    similarityScore: number
    excerpt: string
  }>
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  processingTime: number
}

export interface StreamingChatResponse {
  sessionId: string
  messageId: string
  sources: Array<{
    id: string
    title: string
    chapterTitle: string
    pageStart: number
    similarityScore: number
    excerpt: string
  }>
}

export interface ChatSession {
  id: string
  title: string
  mode: 'academic' | 'clinical'
  userId?: string
  isActive: boolean
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
  lastMessageAt?: Date
}

export class ChatOrchestrator {
  /**
   * Process a chat message and return complete response
   */
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now()
    
    log.info('Processing chat request', {
      messageLength: request.message.length,
      mode: request.mode,
      sessionId: request.sessionId,
      hasUserId: !!request.userId
    })
    
    try {
      // Validate request
      this.validateChatRequest(request)
      
      // Get or create session
      const session = await this.getOrCreateSession(request)
      
      // Store user message
      const userMessageId = await this.storeUserMessage(session.id, request.message)
      
      // Search for relevant context
      const searchResults = await vectorSearchService.searchSimilar(request.message, {
        maxResults: 5,
        similarityThreshold: 0.7
      })
      
      log.debug('Context search completed', {
        sessionId: session.id,
        resultsCount: searchResults.length,
        topSimilarity: searchResults[0]?.similarityScore || 0
      })
      
      // Assemble context
      const context = assembleContext(searchResults, request.message, {
        maxTokens: 3000,
        maxSources: 5
      })
      
      // Build messages for AI
      const messages = await this.buildChatMessages(session.id, request, context.contextText)
      
      // Generate AI response
      const aiResponse = await mistralService.generateChatCompletion(messages, {
        temperature: request.mode === 'academic' ? 0.3 : 0.7,
        maxTokens: 2000
      })
      
      const responseContent = aiResponse.choices[0].message.content
      
      // Store assistant message
      const assistantMessageId = await this.storeAssistantMessage(
        session.id,
        responseContent,
        {
          model: aiResponse.model,
          tokensUsed: aiResponse.usage.totalTokens,
          responseTime: Date.now() - startTime,
          contextChunks: searchResults.map(r => r.id),
          similarityScores: searchResults.map(r => r.similarityScore)
        }
      )
      
      // Update session
      await this.updateSessionActivity(session.id)
      
      const processingTime = Date.now() - startTime
      
      log.info('Chat processing completed', {
        sessionId: session.id,
        messageId: assistantMessageId,
        responseLength: responseContent.length,
        sourcesCount: context.sources.length,
        processingTime,
        tokensUsed: aiResponse.usage.totalTokens
      })
      
      return {
        sessionId: session.id,
        messageId: assistantMessageId,
        response: responseContent,
        sources: context.sources,
        usage: aiResponse.usage,
        processingTime
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime
      
      log.error('Chat processing failed', {
        messageLength: request.message.length,
        mode: request.mode,
        processingTime
      }, error as Error)
      
      throw error
    }
  }
  
  /**
   * Process streaming chat and yield chunks
   */
  async* processStreamingChat(request: ChatRequest): AsyncGenerator<StreamingChunk | StreamingChatResponse, void, unknown> {
    const startTime = Date.now()
    
    log.info('Processing streaming chat request', {
      messageLength: request.message.length,
      mode: request.mode,
      sessionId: request.sessionId
    })
    
    try {
      // Validate request
      this.validateChatRequest(request)
      
      // Get or create session
      const session = await this.getOrCreateSession(request)
      
      // Store user message
      const userMessageId = await this.storeUserMessage(session.id, request.message)
      
      // Search for relevant context
      const searchResults = await vectorSearchService.searchSimilar(request.message, {
        maxResults: 5,
        similarityThreshold: 0.7
      })
      
      // Assemble context
      const context = assembleContext(searchResults, request.message, {
        maxTokens: 3000,
        maxSources: 5
      })
      
      // Build messages for AI
      const messages = await this.buildChatMessages(session.id, request, context.contextText)
      
      // Create assistant message record (will be updated as we stream)
      const assistantMessageId = await this.createStreamingMessage(session.id)
      
      // Yield initial response with sources
      yield {
        sessionId: session.id,
        messageId: assistantMessageId,
        sources: context.sources
      }
      
      // Stream AI response
      let fullResponse = ''
      let chunkCount = 0
      
      const streamGenerator = mistralService.generateStreamingChatCompletion(messages, {
        temperature: request.mode === 'academic' ? 0.3 : 0.7,
        maxTokens: 2000
      })
      
      for await (const chunk of streamGenerator) {
        chunkCount++
        
        // Accumulate response content
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          fullResponse += content
        }
        
        // Yield chunk to client
        yield chunk
        
        // Log progress periodically
        if (chunkCount % 10 === 0) {
          log.debug('Streaming progress', {
            sessionId: session.id,
            chunkCount,
            responseLength: fullResponse.length
          })
        }
      }
      
      // Update the assistant message with final content
      await this.updateStreamingMessage(assistantMessageId, fullResponse, {
        model: 'mistral-large-latest',
        tokensUsed: Math.ceil(fullResponse.length / 4), // Rough estimate
        responseTime: Date.now() - startTime,
        contextChunks: searchResults.map(r => r.id),
        similarityScores: searchResults.map(r => r.similarityScore)
      })
      
      // Update session activity
      await this.updateSessionActivity(session.id)
      
      const processingTime = Date.now() - startTime
      
      log.info('Streaming chat completed', {
        sessionId: session.id,
        messageId: assistantMessageId,
        chunkCount,
        responseLength: fullResponse.length,
        processingTime
      })
      
    } catch (error) {
      log.error('Streaming chat failed', {
        messageLength: request.message.length,
        mode: request.mode
      }, error as Error)
      
      throw error
    }
  }
  
  /**
   * Get or create chat session
   */
  private async getOrCreateSession(request: ChatRequest): Promise<ChatSession> {
    if (request.sessionId) {
      // Try to get existing session
      const result = await query(
        'SELECT * FROM chat_sessions WHERE id = $1 AND is_active = true',
        [request.sessionId]
      )
      
      if (result.rows.length > 0) {
        const row = result.rows[0]
        return {
          id: row.id,
          title: row.title,
          mode: row.mode,
          userId: row.user_id,
          isActive: row.is_active,
          isPinned: row.is_pinned,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastMessageAt: row.last_message_at
        }
      }
    }
    
    // Create new session
    const sessionId = uuidv4()
    const title = this.generateSessionTitle(request.message)
    
    const result = await query(`
      INSERT INTO chat_sessions (id, title, mode, user_id, session_token)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [sessionId, title, request.mode, request.userId, request.sessionToken])
    
    const row = result.rows[0]
    
    log.info('Created new chat session', {
      sessionId,
      title,
      mode: request.mode,
      hasUserId: !!request.userId
    })
    
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      userId: row.user_id,
      isActive: row.is_active,
      isPinned: row.is_pinned,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at
    }
  }
  
  /**
   * Store user message in database
   */
  private async storeUserMessage(sessionId: string, content: string): Promise<string> {
    const messageId = uuidv4()
    
    await query(`
      INSERT INTO chat_messages (id, session_id, role, content)
      VALUES ($1, $2, 'user', $3)
    `, [messageId, sessionId, content])
    
    return messageId
  }
  
  /**
   * Store assistant message in database
   */
  private async storeAssistantMessage(
    sessionId: string,
    content: string,
    metadata: {
      model: string
      tokensUsed: number
      responseTime: number
      contextChunks: string[]
      similarityScores: number[]
    }
  ): Promise<string> {
    const messageId = uuidv4()
    
    await query(`
      INSERT INTO chat_messages (
        id, session_id, role, content, model_used, tokens_used, 
        response_time_ms, context_chunks, similarity_scores, is_complete
      ) VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8, true)
    `, [
      messageId,
      sessionId,
      content,
      metadata.model,
      metadata.tokensUsed,
      metadata.responseTime,
      metadata.contextChunks,
      metadata.similarityScores
    ])
    
    return messageId
  }
  
  /**
   * Create streaming message record
   */
  private async createStreamingMessage(sessionId: string): Promise<string> {
    const messageId = uuidv4()
    
    await query(`
      INSERT INTO chat_messages (id, session_id, role, content, is_streaming, is_complete)
      VALUES ($1, $2, 'assistant', '', true, false)
    `, [messageId, sessionId])
    
    return messageId
  }
  
  /**
   * Update streaming message with final content
   */
  private async updateStreamingMessage(
    messageId: string,
    content: string,
    metadata: {
      model: string
      tokensUsed: number
      responseTime: number
      contextChunks: string[]
      similarityScores: number[]
    }
  ): Promise<void> {
    await query(`
      UPDATE chat_messages 
      SET content = $2, model_used = $3, tokens_used = $4, response_time_ms = $5,
          context_chunks = $6, similarity_scores = $7, is_streaming = false, is_complete = true
      WHERE id = $1
    `, [
      messageId,
      content,
      metadata.model,
      metadata.tokensUsed,
      metadata.responseTime,
      metadata.contextChunks,
      metadata.similarityScores
    ])
  }
  
  /**
   * Update session activity timestamp
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    await query(`
      UPDATE chat_sessions 
      SET last_message_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [sessionId])
  }
  
  /**
   * Build chat messages for AI including context and history
   */
  private async buildChatMessages(
    sessionId: string,
    request: ChatRequest,
    contextText: string
  ): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = []
    
    // Add system prompt
    messages.push({
      role: 'system',
      content: buildSystemPrompt(request.mode)
    })
    
    // Get recent conversation history (last 10 messages)
    const historyResult = await query(`
      SELECT role, content FROM chat_messages 
      WHERE session_id = $1 AND is_complete = true
      ORDER BY created_at DESC 
      LIMIT 10
    `, [sessionId])
    
    // Add history in chronological order
    const history = historyResult.rows.reverse()
    for (const msg of history) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })
    }
    
    // Build user prompt with context
    const userPrompt = buildUserPrompt({
      query: request.message,
      context: contextText,
      mode: request.mode
    })
    
    messages.push({
      role: 'user',
      content: userPrompt
    })
    
    return messages
  }
  
  /**
   * Generate session title from first message
   */
  private generateSessionTitle(message: string): string {
    // Extract key medical terms or use first few words
    const words = message.trim().split(/\s+/).slice(0, 6)
    let title = words.join(' ')
    
    if (title.length > 50) {
      title = title.substring(0, 47) + '...'
    }
    
    return title || 'New Chat'
  }
  
  /**
   * Validate chat request
   */
  private validateChatRequest(request: ChatRequest): void {
    if (!request.message || request.message.trim().length === 0) {
      throw new ValidationError('Message cannot be empty')
    }
    
    if (request.message.length > 10000) {
      throw new ValidationError('Message too long (max 10,000 characters)')
    }
    
    if (!['academic', 'clinical'].includes(request.mode)) {
      throw new ValidationError('Mode must be either "academic" or "clinical"')
    }
  }
  
  /**
   * Get chat session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const result = await query(
        'SELECT * FROM chat_sessions WHERE id = $1',
        [sessionId]
      )
      
      if (result.rows.length === 0) return null
      
      const row = result.rows[0]
      return {
        id: row.id,
        title: row.title,
        mode: row.mode,
        userId: row.user_id,
        isActive: row.is_active,
        isPinned: row.is_pinned,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastMessageAt: row.last_message_at
      }
      
    } catch (error) {
      log.error('Failed to get session', { sessionId }, error as Error)
      throw new DatabaseError('Failed to retrieve session', error as Error)
    }
  }
  
  /**
   * Get chat messages for a session
   */
  async getSessionMessages(sessionId: string, limit: number = 50): Promise<Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: Date
    tokensUsed?: number
    sources?: string[]
  }>> {
    try {
      const result = await query(`
        SELECT id, role, content, created_at, tokens_used, context_chunks
        FROM chat_messages 
        WHERE session_id = $1 AND is_complete = true
        ORDER BY created_at DESC 
        LIMIT $2
      `, [sessionId, limit])
      
      return result.rows.reverse().map(row => ({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        tokensUsed: row.tokens_used,
        sources: row.context_chunks
      }))
      
    } catch (error) {
      log.error('Failed to get session messages', { sessionId }, error as Error)
      throw new DatabaseError('Failed to retrieve messages', error as Error)
    }
  }
}

// Singleton instance
export const chatOrchestrator = new ChatOrchestrator()

