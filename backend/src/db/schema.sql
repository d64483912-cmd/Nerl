-- Nelson-GPT Database Schema
-- PostgreSQL with pgvector extension for vector similarity search

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types
CREATE TYPE content_type AS ENUM ('chapter', 'section', 'subsection', 'table', 'figure', 'reference');
CREATE TYPE medical_specialty AS ENUM (
  'general_pediatrics',
  'neonatology',
  'cardiology',
  'pulmonology',
  'gastroenterology',
  'nephrology',
  'endocrinology',
  'hematology_oncology',
  'infectious_diseases',
  'neurology',
  'rheumatology',
  'emergency_medicine',
  'critical_care',
  'developmental_pediatrics',
  'adolescent_medicine'
);

-- Document chunks table for storing Nelson textbook content
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content information
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type content_type NOT NULL DEFAULT 'section',
  
  -- Source metadata
  chapter_number INTEGER,
  chapter_title TEXT,
  section_title TEXT,
  page_start INTEGER,
  page_end INTEGER,
  
  -- Medical categorization
  medical_specialty medical_specialty[],
  keywords TEXT[],
  age_groups TEXT[], -- e.g., ['neonate', 'infant', 'child', 'adolescent']
  
  -- Vector embedding (384 dimensions for sentence-transformers/all-MiniLM-L6-v2)
  embedding vector(384),
  
  -- Content metrics
  word_count INTEGER,
  character_count INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(chapter_title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) STORED
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector ON document_chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chapter ON document_chunks(chapter_number);
CREATE INDEX IF NOT EXISTS idx_document_chunks_specialty ON document_chunks USING gin(medical_specialty);
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_type ON document_chunks(content_type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_age_groups ON document_chunks USING gin(age_groups);
CREATE INDEX IF NOT EXISTS idx_document_chunks_created_at ON document_chunks(created_at);

-- Chat sessions table for storing user conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session metadata
  title TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('academic', 'clinical')) DEFAULT 'academic',
  
  -- User information (optional, for future user management)
  user_id TEXT,
  session_token TEXT,
  
  -- Session state
  is_active BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  
  -- Assistant message metadata
  model_used TEXT, -- e.g., 'mistral-large-latest'
  tokens_used INTEGER,
  response_time_ms INTEGER,
  
  -- Context used for RAG
  context_chunks UUID[], -- Array of document_chunk IDs used
  similarity_scores FLOAT[], -- Corresponding similarity scores
  
  -- Message state
  is_streaming BOOLEAN DEFAULT false,
  is_complete BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for chat tables
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);

-- Search analytics table (optional, for improving search quality)
CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Query information
  query_text TEXT NOT NULL,
  query_embedding vector(384),
  
  -- Search results
  results_count INTEGER,
  top_similarity_score FLOAT,
  
  -- User interaction
  session_id UUID REFERENCES chat_sessions(id),
  clicked_chunks UUID[], -- Which chunks the user found helpful
  
  -- Performance metrics
  search_time_ms INTEGER,
  embedding_time_ms INTEGER,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query_embedding ON search_analytics USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_document_chunks_updated_at BEFORE UPDATE ON document_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for similarity search with filters
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(384),
  similarity_threshold float DEFAULT 0.7,
  max_results integer DEFAULT 10,
  filter_specialty medical_specialty[] DEFAULT NULL,
  filter_content_type content_type[] DEFAULT NULL,
  filter_age_groups text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  chapter_title text,
  page_start integer,
  similarity_score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.title,
    dc.content,
    dc.chapter_title,
    dc.page_start,
    (1 - (dc.embedding <=> query_embedding)) as similarity_score
  FROM document_chunks dc
  WHERE 
    (1 - (dc.embedding <=> query_embedding)) >= similarity_threshold
    AND (filter_specialty IS NULL OR dc.medical_specialty && filter_specialty)
    AND (filter_content_type IS NULL OR dc.content_type = ANY(filter_content_type))
    AND (filter_age_groups IS NULL OR dc.age_groups && filter_age_groups)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Sample data insertion function (for testing)
CREATE OR REPLACE FUNCTION insert_sample_content()
RETURNS void AS $$
BEGIN
  -- Insert sample Nelson textbook content
  INSERT INTO document_chunks (
    title,
    content,
    content_type,
    chapter_number,
    chapter_title,
    medical_specialty,
    keywords,
    age_groups,
    word_count,
    character_count
  ) VALUES 
  (
    'Fever in Infants and Children',
    'Fever is one of the most common presenting symptoms in pediatric practice. It is defined as a rectal temperature ≥38.0°C (100.4°F), oral temperature ≥37.8°C (100.0°F), or axillary temperature ≥37.2°C (99.0°F). The approach to fever varies significantly based on the age of the child, with special considerations for neonates and young infants.',
    'section',
    181,
    'Fever Without a Focus',
    ARRAY['general_pediatrics', 'infectious_diseases']::medical_specialty[],
    ARRAY['fever', 'temperature', 'pediatric', 'infant', 'infection'],
    ARRAY['neonate', 'infant', 'child'],
    65,
    400
  ),
  (
    'Developmental Milestones',
    'Normal child development follows predictable patterns, though there is considerable individual variation. Key milestones include: 2 months - social smile, follows objects; 4 months - rolls over, laughs; 6 months - sits without support, babbles; 9 months - crawls, says mama/dada; 12 months - walks independently, first words; 18 months - runs, vocabulary of 10-25 words.',
    'section',
    12,
    'Child Development and Behavior',
    ARRAY['developmental_pediatrics', 'general_pediatrics']::medical_specialty[],
    ARRAY['development', 'milestones', 'motor', 'language', 'social'],
    ARRAY['infant', 'child'],
    58,
    380
  );
END;
$$ LANGUAGE plpgsql;

