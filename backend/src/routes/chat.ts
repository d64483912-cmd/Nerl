import { Router, Request, Response } from 'express'
import { body, param, validationResult } from 'express-validator'
import { chatOrchestrator } from '../services/chatOrchestrator.js'
import { logger, createRequestLogger } from '../utils/logger.js'
import { handleApiError } from '../utils/errors.js'

const router = Router()
const log = createRequestLogger('ChatRoutes')

// Validation middleware
const validateChatRequest = [
  body('message')
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Message must be between 1 and 10,000 characters'),
  body('mode')
    .isIn(['academic', 'clinical'])
    .withMessage('Mode must be either "academic" or "clinical"'),
  body('sessionId')
    .optional()
    .isUUID()
    .withMessage('Session ID must be a valid UUID'),
  body('userId')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('User ID must be a string with max 255 characters'),
  body('sessionToken')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Session token must be a string with max 255 characters')
]

const validateSessionId = [
  param('sessionId')
    .isUUID()
    .withMessage('Session ID must be a valid UUID')
]

/**
 * POST /api/chat
 * Standard chat completion (non-streaming)
 */
router.post('/', validateChatRequest, async (req: Request, res: Response) => {
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
    
    const { message, mode, sessionId, userId, sessionToken } = req.body
    
    log.info('Chat request received', {
      requestId: req.requestId,
      messageLength: message.length,
      mode,
      hasSessionId: !!sessionId,
      hasUserId: !!userId
    })
    
    // Process chat request
    const response = await chatOrchestrator.processChat({
      message,
      mode,
      sessionId,
      userId,
      sessionToken
    })
    
    log.info('Chat request completed', {
      requestId: req.requestId,
      sessionId: response.sessionId,
      messageId: response.messageId,
      responseLength: response.response.length,
      sourcesCount: response.sources.length,
      processingTime: response.processingTime
    })
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    log.error('Chat request failed', {
      requestId: req.requestId,
      error: (error as Error).message
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * POST /api/chat/stream
 * Streaming chat completion with Server-Sent Events
 */
router.post('/stream', validateChatRequest, async (req: Request, res: Response) => {
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
    
    const { message, mode, sessionId, userId, sessionToken } = req.body
    
    log.info('Streaming chat request received', {
      requestId: req.requestId,
      messageLength: message.length,
      mode,
      hasSessionId: !!sessionId,
      hasUserId: !!userId
    })
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })
    
    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
    
    let chunkCount = 0
    let sessionInfo: { sessionId: string; messageId: string; sources: any[] } | null = null
    
    try {
      // Process streaming chat
      const streamGenerator = chatOrchestrator.processStreamingChat({
        message,
        mode,
        sessionId,
        userId,
        sessionToken
      })
      
      for await (const chunk of streamGenerator) {
        chunkCount++
        
        // Handle initial response with session info and sources
        if ('sessionId' in chunk && 'messageId' in chunk) {
          sessionInfo = chunk
          res.write(`data: ${JSON.stringify({
            type: 'session',
            sessionId: chunk.sessionId,
            messageId: chunk.messageId,
            sources: chunk.sources
          })}\n\n`)
          continue
        }
        
        // Handle streaming chunks from Mistral
        if ('choices' in chunk) {
          const content = chunk.choices[0]?.delta?.content
          const finishReason = chunk.choices[0]?.finish_reason
          
          if (content) {
            res.write(`data: ${JSON.stringify({
              type: 'content',
              content: content
            })}\n\n`)
          }
          
          if (finishReason) {
            res.write(`data: ${JSON.stringify({
              type: 'finish',
              reason: finishReason
            })}\n\n`)
            break
          }
        }
        
        // Log progress periodically
        if (chunkCount % 20 === 0) {
          log.debug('Streaming progress', {
            requestId: req.requestId,
            chunkCount
          })
        }
      }
      
      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      
      log.info('Streaming chat completed', {
        requestId: req.requestId,
        sessionId: sessionInfo?.sessionId,
        messageId: sessionInfo?.messageId,
        chunkCount
      })
      
    } catch (streamError) {
      log.error('Streaming error', {
        requestId: req.requestId,
        chunkCount
      }, streamError as Error)
      
      // Send error to client
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: {
          message: (streamError as Error).message,
          code: streamError.constructor.name
        }
      })}\n\n`)
    }
    
    res.end()
    
  } catch (error) {
    log.error('Streaming chat setup failed', {
      requestId: req.requestId,
      error: (error as Error).message
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/chat/sessions/:sessionId
 * Get chat session details
 */
router.get('/sessions/:sessionId', validateSessionId, async (req: Request, res: Response) => {
  try {
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
    
    const { sessionId } = req.params
    
    log.info('Session details request', {
      requestId: req.requestId,
      sessionId
    })
    
    const session = await chatOrchestrator.getSession(sessionId)
    
    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        },
        timestamp: new Date().toISOString()
      })
    }
    
    res.json({
      success: true,
      data: session,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    log.error('Session details request failed', {
      requestId: req.requestId,
      sessionId: req.params.sessionId
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

/**
 * GET /api/chat/sessions/:sessionId/messages
 * Get chat messages for a session
 */
router.get('/sessions/:sessionId/messages', validateSessionId, async (req: Request, res: Response) => {
  try {
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
    
    const { sessionId } = req.params
    const limit = parseInt(req.query.limit as string) || 50
    
    log.info('Session messages request', {
      requestId: req.requestId,
      sessionId,
      limit
    })
    
    const messages = await chatOrchestrator.getSessionMessages(sessionId, limit)
    
    res.json({
      success: true,
      data: {
        sessionId,
        messages,
        count: messages.length
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    log.error('Session messages request failed', {
      requestId: req.requestId,
      sessionId: req.params.sessionId
    }, error as Error)
    
    const { statusCode, response } = handleApiError(error as Error, req.path)
    res.status(statusCode).json(response)
  }
})

export { router as chatRoutes }

