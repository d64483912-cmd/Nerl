// Custom error classes for better error handling
export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  
  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(`Database error: ${message}`, 500)
    if (originalError) {
      this.stack = originalError.stack
    }
  }
}

export class EmbeddingError extends AppError {
  constructor(message: string) {
    super(`Embedding service error: ${message}`, 502)
  }
}

export class MistralError extends AppError {
  constructor(message: string, statusCode: number = 502) {
    super(`Mistral API error: ${message}`, statusCode)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429)
  }
}

// Error response formatter for API routes
export interface ErrorResponse {
  error: {
    message: string
    code?: string
    details?: any
  }
  timestamp: string
  path?: string
}

export function formatErrorResponse(
  error: Error,
  path?: string
): ErrorResponse {
  const isAppError = error instanceof AppError
  
  return {
    error: {
      message: isAppError ? error.message : 'Internal server error',
      code: error.constructor.name,
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          stack: error.stack,
          originalMessage: error.message,
        }
      }),
    },
    timestamp: new Date().toISOString(),
    ...(path && { path }),
  }
}

// Error handler for API routes
export function handleApiError(error: Error, path?: string) {
  const statusCode = error instanceof AppError ? error.statusCode : 500
  const response = formatErrorResponse(error, path)
  
  return {
    statusCode,
    response,
  }
}

