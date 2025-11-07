import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Environment configuration and validation
export const config = {
  // Server
  server: {
    port: parseInt(process.env.PORT || '3001'),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    unpooledUrl: process.env.DATABASE_URL_UNPOOLED,
  },
  
  // AI Services
  ai: {
    mistralApiKey: process.env.MISTRAL_API_KEY,
    huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY,
    embeddingModel: process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    vectorDimension: parseInt(process.env.VECTOR_DIM || '384'),
  },
  
  // Application
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },
  
  // Rate limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  },
  
  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL,
  },
}

// Validation function
export function validateConfig() {
  const required = [
    'DATABASE_URL',
    'MISTRAL_API_KEY',
    'HUGGINGFACE_API_KEY',
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  
  if (config.ai.vectorDimension !== 384) {
    console.warn('Warning: Vector dimension is not 384, ensure it matches your embedding model')
  }
}

// Initialize validation in non-test environments
if (process.env.NODE_ENV !== 'test') {
  try {
    validateConfig()
  } catch (error) {
    console.error('Configuration validation failed:', error)
    if (config.app.isProduction) {
      process.exit(1)
    }
  }
}

