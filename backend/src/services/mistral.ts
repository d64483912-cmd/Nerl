import { config } from '../config/index.js'
import { logger, createRequestLogger } from '../utils/logger.js'
import { MistralError } from '../utils/errors.js'

const log = createRequestLogger('MistralService')

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
  safePrompt?: boolean
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finishReason: string
  }>
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface StreamingChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
    }
    finishReason?: string
  }>
}

export class MistralService {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly defaultModel: string
  
  constructor() {
    this.apiKey = config.ai.mistralApiKey!
    this.baseUrl = 'https://api.mistral.ai/v1'
    this.defaultModel = 'mistral-large-latest'
  }
  
  /**
   * Generate chat completion (non-streaming)
   */
  async generateChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now()
    
    const requestOptions = {
      model: options.model || this.defaultModel,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      top_p: options.topP ?? 1.0,
      stream: false,
      safe_prompt: options.safePrompt ?? false,
    }
    
    log.info('Generating chat completion', {
      model: requestOptions.model,
      messageCount: messages.length,
      temperature: requestOptions.temperature,
      maxTokens: requestOptions.max_tokens
    })
    
    try {
      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(requestOptions),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new MistralError(
          `API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
          response.status
        )
      }
      
      const data = await response.json()
      const processingTime = Date.now() - startTime
      
      log.info('Chat completion generated', {
        model: data.model,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
        processingTime,
        finishReason: data.choices?.[0]?.finish_reason
      })
      
      return {
        id: data.id,
        object: data.object,
        created: data.created,
        model: data.model,
        choices: data.choices.map((choice: any) => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content
          },
          finishReason: choice.finish_reason
        })),
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        }
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime
      
      log.error('Chat completion failed', {
        model: requestOptions.model,
        messageCount: messages.length,
        processingTime
      }, error as Error)
      
      if (error instanceof MistralError) {
        throw error
      }
      
      throw new MistralError(`Chat completion failed: ${(error as Error).message}`)
    }
  }
  
  /**
   * Generate streaming chat completion
   */
  async* generateStreamingChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    const startTime = Date.now()
    
    const requestOptions = {
      model: options.model || this.defaultModel,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      top_p: options.topP ?? 1.0,
      stream: true,
      safe_prompt: options.safePrompt ?? false,
    }
    
    log.info('Starting streaming chat completion', {
      model: requestOptions.model,
      messageCount: messages.length,
      temperature: requestOptions.temperature,
      maxTokens: requestOptions.max_tokens
    })
    
    let response: Response
    
    try {
      response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(requestOptions),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new MistralError(
          `Streaming API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
          response.status
        )
      }
      
    } catch (error) {
      log.error('Streaming chat completion request failed', {
        model: requestOptions.model,
        messageCount: messages.length
      }, error as Error)
      
      throw error instanceof MistralError ? error : new MistralError(`Streaming request failed: ${(error as Error).message}`)
    }
    
    const reader = response.body?.getReader()
    if (!reader) {
      throw new MistralError('No response body reader available')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    let chunkCount = 0
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          log.info('Streaming chat completion finished', {
            model: requestOptions.model,
            chunkCount,
            totalTime: Date.now() - startTime
          })
          break
        }
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          
          if (trimmedLine === '') continue
          if (trimmedLine === 'data: [DONE]') {
            log.debug('Received streaming completion signal')
            return
          }
          
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6) // Remove 'data: ' prefix
              const chunk = JSON.parse(jsonStr) as StreamingChunk
              
              chunkCount++
              
              log.debug('Received streaming chunk', {
                chunkIndex: chunkCount,
                hasContent: !!chunk.choices?.[0]?.delta?.content,
                finishReason: chunk.choices?.[0]?.finish_reason
              })
              
              yield chunk
              
            } catch (parseError) {
              log.warn('Failed to parse streaming chunk', {
                line: trimmedLine,
                error: (parseError as Error).message
              })
            }
          }
        }
      }
      
    } catch (error) {
      log.error('Streaming chat completion failed', {
        model: requestOptions.model,
        chunkCount,
        totalTime: Date.now() - startTime
      }, error as Error)
      
      throw new MistralError(`Streaming failed: ${(error as Error).message}`)
      
    } finally {
      reader.releaseLock()
    }
  }
  
  /**
   * Make HTTP request to Mistral API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Nelson-GPT/1.0.0',
      ...options.headers,
    }
    
    return fetch(url, {
      ...options,
      headers,
    })
  }
  
  /**
   * Validate connection to Mistral API
   */
  async validateConnection(): Promise<boolean> {
    try {
      log.debug('Validating Mistral API connection')
      
      const response = await this.generateChatCompletion([
        { role: 'user', content: 'Hello' }
      ], {
        maxTokens: 10,
        temperature: 0
      })
      
      const isValid = response.choices.length > 0 && response.choices[0].message.content.length > 0
      
      log.info('Mistral API connection validation', { isValid })
      
      return isValid
      
    } catch (error) {
      log.error('Mistral API connection validation failed', {}, error as Error)
      return false
    }
  }
  
  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/models')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`)
      }
      
      const data = await response.json()
      const models = data.data?.map((model: any) => model.id) || []
      
      log.info('Retrieved available models', { modelCount: models.length })
      
      return models
      
    } catch (error) {
      log.warn('Failed to get available models, using default', {}, error as Error)
      return [this.defaultModel]
    }
  }
}

// Singleton instance
export const mistralService = new MistralService()

// Export convenience functions
export async function generateChatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  return mistralService.generateChatCompletion(messages, options)
}

export async function generateStreamingChatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): AsyncGenerator<StreamingChunk, void, unknown> {
  return mistralService.generateStreamingChatCompletion(messages, options)
}

