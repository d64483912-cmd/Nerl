# Nelson-GPT Backend

A production-ready RAG (Retrieval-Augmented Generation) backend for Nelson-GPT, a pediatric medical AI assistant based on the Nelson Textbook of Pediatrics.

## 🏗️ Architecture

### Core Components

- **Express.js Server**: RESTful API with streaming support
- **PostgreSQL + pgvector**: Vector database for semantic search
- **Mistral API**: Large language model for chat completions
- **HuggingFace**: Embedding generation service
- **RAG Pipeline**: Complete retrieval-augmented generation workflow

### Key Features

- 🔍 **Vector Similarity Search**: pgvector with 384-dimensional embeddings
- 🔄 **Streaming Chat**: Server-Sent Events for real-time responses
- 🏥 **Medical Specialization**: 15 pediatric specialties with age-specific filtering
- 📊 **Hybrid Search**: Combines vector similarity and full-text search
- 🛡️ **Production Ready**: Comprehensive logging, error handling, and health checks
- 🎯 **Context Assembly**: Smart source selection with diversity filtering

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ with npm/yarn
- PostgreSQL database with pgvector extension
- Mistral API key
- HuggingFace API key

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database and API keys
   ```

3. **Run database migrations**:
   ```bash
   npm run migrate
   ```

4. **Seed with sample data** (optional):
   ```bash
   npm run seed
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

### Environment Variables

```bash
# Database (required)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# AI Services (required)
MISTRAL_API_KEY=your_mistral_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key

# Server Configuration
PORT=3001
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development

# Optional
REDIS_URL=redis://localhost:6379
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

## 📚 API Documentation

### Chat Endpoints

#### POST `/api/chat`
Standard chat completion (non-streaming)

```json
{
  "message": "What causes fever in infants?",
  "mode": "clinical",
  "sessionId": "optional-uuid",
  "userId": "optional-user-id"
}
```

#### POST `/api/chat/stream`
Streaming chat with Server-Sent Events

```bash
curl -X POST http://localhost:3001/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Fever management in neonates", "mode": "academic"}'
```

#### GET `/api/chat/sessions/:sessionId`
Get chat session details

#### GET `/api/chat/sessions/:sessionId/messages`
Get chat messages for a session

### Search Endpoints

#### GET `/api/search`
Vector similarity search

```bash
curl "http://localhost:3001/api/search?q=asthma&maxResults=5&specialty=pulmonology"
```

#### GET `/api/search/hybrid`
Hybrid search (vector + full-text)

#### GET `/api/search/suggestions`
Autocomplete suggestions

#### GET `/api/search/filters`
Available filter options

### Health Endpoints

#### GET `/api/health`
Basic health check

#### GET `/api/health/detailed`
Comprehensive system health

#### GET `/api/health/database`
Database-specific health

#### GET `/api/health/ai`
AI services health

## 🛠️ Development

### Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run migrate      # Run database migrations
npm run seed         # Seed database with sample data
npm run health       # Run health check
npm test             # Run tests
```

### Database Management

```bash
# Run migrations
npm run migrate

# Run migrations with sample data
npm run migrate -- --sample

# Seed database (requires existing schema)
npm run seed

# Force seed (add to existing data)
npm run seed -- --force

# Health check
npm run health

# Health check with JSON output
npm run health -- --json
```

### Project Structure

```
backend/
├── src/
│   ├── config/           # Environment configuration
│   ├── db/              # Database connection and migrations
│   │   ├── connection.ts
│   │   ├── migrations.ts
│   │   └── schema.sql
│   ├── services/        # Core business logic
│   │   ├── embeddings.ts
│   │   ├── vectorSearch.ts
│   │   ├── mistral.ts
│   │   └── chatOrchestrator.ts
│   ├── routes/          # API endpoints
│   │   ├── chat.ts
│   │   ├── search.ts
│   │   └── health.ts
│   ├── utils/           # Utilities and helpers
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   ├── textProcessing.ts
│   │   └── contextAssembly.ts
│   ├── prompts/         # AI prompt templates
│   │   └── medical.ts
│   ├── scripts/         # CLI tools
│   │   ├── migrate.ts
│   │   ├── seed.ts
│   │   └── healthCheck.ts
│   └── server.ts        # Main application entry
├── package.json
├── tsconfig.json
└── README.md
```

## 🏥 Medical Features

### Specialties Supported

- General Pediatrics
- Neonatology
- Cardiology
- Pulmonology
- Gastroenterology
- Nephrology
- Endocrinology
- Hematology/Oncology
- Infectious Diseases
- Neurology
- Rheumatology
- Emergency Medicine
- Critical Care
- Developmental Pediatrics
- Adolescent Medicine

### Age Groups

- Neonate (0-28 days)
- Infant (1-12 months)
- Toddler (1-3 years)
- Child (3-12 years)
- Adolescent (12-18 years)

### Chat Modes

- **Academic Mode**: Comprehensive, textbook-style explanations
- **Clinical Mode**: Practical, actionable clinical guidance

## 🔧 Configuration

### Database Schema

The system uses PostgreSQL with the pgvector extension for vector similarity search:

- **document_chunks**: Medical content with 384-dimensional embeddings
- **chat_sessions**: User conversation sessions
- **chat_messages**: Individual messages with context tracking
- **search_analytics**: Search performance metrics

### Vector Search

- **Model**: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
- **Index**: IVFFlat with 100 lists for approximate nearest neighbor search
- **Similarity**: Cosine distance with configurable thresholds
- **Hybrid Search**: 70% vector similarity + 30% full-text search

### AI Integration

- **Chat Model**: Mistral Large Latest
- **Temperature**: 0.3 (academic) / 0.7 (clinical)
- **Max Tokens**: 2000 for responses
- **Context Limit**: 3000 tokens for retrieved content

## 📊 Monitoring

### Health Checks

The system provides comprehensive health monitoring:

```bash
# Basic health check
curl http://localhost:3001/api/health

# Detailed system health
curl http://localhost:3001/api/health/detailed

# Database health
curl http://localhost:3001/api/health/database

# AI services health
curl http://localhost:3001/api/health/ai
```

### Logging

Structured JSON logging with multiple levels:

- **ERROR**: System errors and failures
- **WARN**: Warnings and degraded performance
- **INFO**: General operational information
- **DEBUG**: Detailed debugging information

### Metrics

- Request/response times
- Token usage tracking
- Search performance metrics
- Database query performance
- AI service response times

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Setup

1. **Database**: PostgreSQL with pgvector extension
2. **Environment Variables**: Set all required variables
3. **Migrations**: Run `npm run migrate` on first deployment
4. **Health Check**: Verify all services with `npm run health`

### Docker Support

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run health checks: `npm run health`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:

1. Check the health endpoints: `/api/health/detailed`
2. Review logs for error messages
3. Verify environment configuration
4. Test individual services (database, AI APIs)

## 🔗 Related

- [Frontend Repository](../README.md)
- [Nelson Textbook of Pediatrics](https://www.elsevier.com/books/nelson-textbook-of-pediatrics)
- [Mistral AI Documentation](https://docs.mistral.ai/)
- [HuggingFace Inference API](https://huggingface.co/docs/api-inference)
- [pgvector Documentation](https://github.com/pgvector/pgvector)

