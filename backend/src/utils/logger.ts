// Centralized logging utility
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogContext {
  userId?: string
  sessionId?: string
  requestId?: string
  component?: string
  [key: string]: any
}

class Logger {
  private level: LogLevel
  
  constructor() {
    this.level = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
  }
  
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (level > this.level) return
    
    const timestamp = new Date().toISOString()
    const levelName = LogLevel[level]
    
    const logEntry = {
      timestamp,
      level: levelName,
      message,
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      }),
    }
    
    const output = JSON.stringify(logEntry, null, 2)
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(output)
        break
      case LogLevel.WARN:
        console.warn(output)
        break
      case LogLevel.INFO:
        console.info(output)
        break
      case LogLevel.DEBUG:
        console.debug(output)
        break
    }
  }
  
  error(message: string, context?: LogContext, error?: Error) {
    this.log(LogLevel.ERROR, message, context, error)
  }
  
  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context)
  }
  
  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context)
  }
  
  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context)
  }
}

export const logger = new Logger()

// Request logging middleware helper
export function createRequestLogger(component: string) {
  return {
    info: (message: string, context?: Omit<LogContext, 'component'>) =>
      logger.info(message, { ...context, component }),
    error: (message: string, context?: Omit<LogContext, 'component'>, error?: Error) =>
      logger.error(message, { ...context, component }, error),
    warn: (message: string, context?: Omit<LogContext, 'component'>) =>
      logger.warn(message, { ...context, component }),
    debug: (message: string, context?: Omit<LogContext, 'component'>) =>
      logger.debug(message, { ...context, component }),
  }
}

