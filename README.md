# 🩺 Nelson-GPT — Pediatric Knowledge at Your Fingertips

**A Perplexity-style chat application for pediatric healthcare professionals, powered by Nelson Textbook of Pediatrics.**

![Nelson-GPT](https://img.shields.io/badge/Nelson--GPT-Pediatric%20AI-F59E0B?style=for-the-badge&logo=stethoscope)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-3178C6?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.3.5-06B6D4?style=for-the-badge&logo=tailwindcss)

## ✨ Features

### 🎯 Core Functionality
- **Perplexity-Style Interface** - Pixel-perfect clone with medical branding
- **RAG-Powered Responses** - Evidence-based answers from Nelson Textbook of Pediatrics
- **Streaming AI Responses** - Real-time token-by-token display
- **Smart Citations** - Automatic linking to medical sources with hover previews
- **Dual Modes** - Academic (detailed explanations) and Clinical (practical guidance)

### 🎨 User Experience
- **Warm Medical Theme** - Professional amber/ivory color palette
- **Smooth Animations** - 60fps transitions with Framer Motion
- **Responsive Design** - Optimized for desktop, tablet, and mobile
- **Progressive Web App** - Installable with offline support
- **Dark/Light Modes** - Accessible themes for clinical settings

### 🔧 Technical Features
- **Modern Stack** - React 18, TypeScript, Vite, TailwindCSS
- **State Management** - Zustand for efficient state handling
- **Vector Search** - Supabase pgvector for semantic search
- **AI Integration** - Mistral API for streaming completions
- **Offline First** - Service worker with intelligent caching

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Supabase account and project
- Mistral AI API key
- OpenAI API key (for embeddings)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/nelson-gpt.git
   cd nelson-gpt
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 🏗️ Project Structure

```
nelson-gpt/
├── public/
│   ├── icons/              # PWA icons
│   ├── manifest.json       # PWA manifest
│   └── sw.js              # Service worker
├── src/
│   ├── components/         # React components
│   │   ├── WelcomeScreen.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── InputDock.tsx
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   ├── store/             # Zustand stores
│   ├── styles/            # Global styles
│   ├── lib/               # Utilities and configs
│   └── types/             # TypeScript definitions
├── api/                   # Backend API routes
└── docs/                  # Documentation
```

## 🎨 Design System

### Color Palette
```css
/* Primary - Warm Amber */
--primary-500: #F59E0B;
--primary-600: #D97706;

/* Medical Theme */
--medical-ivory: #FFFBEB;
--medical-beige: #F4EFEA;
--medical-text: #1C1917;
```

### Typography
- **Font Family**: Inter (system fallback)
- **Sizes**: Responsive scale from 12px to 48px
- **Weights**: 300, 400, 500, 600, 700

### Components
- **Buttons**: Rounded corners (12px), soft shadows
- **Cards**: 20px border radius, medical shadow
- **Inputs**: Focus rings with primary color
- **Messages**: Bubble design with proper spacing

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `MISTRAL_API_KEY` | Mistral AI API key | ✅ |
| `OPENAI_API_KEY` | OpenAI API key for embeddings | ✅ |
| `VITE_ENABLE_VOICE` | Enable voice input | ❌ |
| `VITE_ENABLE_OFFLINE` | Enable offline mode | ❌ |

### Supabase Setup

1. **Create a new Supabase project**
2. **Enable pgvector extension**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. **Create tables**
   ```sql
   -- Pediatric knowledge chunks
   CREATE TABLE nelson_textbook_chunks (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     content TEXT NOT NULL,
     embedding VECTOR(1536),
     metadata JSONB,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create vector index
   CREATE INDEX ON nelson_textbook_chunks 
   USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100);
   ```

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run tests with UI
npm run test:ui

# Run linting
npm run lint
```

## 📦 Building & Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Deploy to Netlify
```bash
# Build
npm run build

# Deploy dist/ folder to Netlify
```

## 🔒 Security & Compliance

### Medical Information Disclaimer
Nelson-GPT provides educational information based on medical literature and should not replace professional medical advice, diagnosis, or treatment. Always consult qualified healthcare providers for medical decisions.

### Data Privacy
- No personal health information is stored
- Chat history is stored locally in browser
- API calls are encrypted in transit
- No data is shared with third parties

### Content Accuracy
- All responses are sourced from Nelson Textbook of Pediatrics
- Citations are provided for verification
- Regular updates to medical knowledge base
- Clear indication of AI-generated content

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Nelson Textbook of Pediatrics** - The authoritative source of pediatric knowledge
- **Perplexity AI** - Inspiration for the user interface design
- **Medical Community** - For feedback and guidance on clinical accuracy

## 📞 Support

- **Documentation**: [docs.nelson-gpt.com](https://docs.nelson-gpt.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/nelson-gpt/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/nelson-gpt/discussions)
- **Email**: support@nelson-gpt.com

---

**Built with ❤️ for pediatric healthcare professionals**

*Nelson-GPT — Trusted Pediatric AI*

