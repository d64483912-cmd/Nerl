import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Stethoscope, GraduationCap } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useChatStore } from '../store/chatStore'
import ModeToggle from './ModeToggle'

const examplePrompts = [
  "What are the signs of dehydration in infants?",
  "Explain the vaccination schedule for a 2-month-old",
  "How do I assess developmental milestones?",
  "What's the differential diagnosis for fever in children?",
]

export default function WelcomeScreen() {
  const [input, setInput] = useState('')
  const [selectedMode, setSelectedMode] = useState<'academic' | 'clinical'>('academic')
  const { setWelcomeMode, setCurrentChatId } = useAppStore()
  const { createChat, addMessage, setCurrentMode } = useChatStore()

  const handleSubmit = () => {
    if (!input.trim()) return
    
    // Create new chat and add first message
    const chatId = createChat(selectedMode)
    setCurrentMode(selectedMode)
    addMessage(chatId, {
      role: 'user',
      content: input.trim(),
    })
    
    // Switch to chat mode
    setCurrentChatId(chatId)
    setWelcomeMode(false)
    
    // Simulate AI response (placeholder)
    setTimeout(() => {
      addMessage(chatId, {
        role: 'assistant',
        content: `I understand you're asking about "${input.trim()}". This is a placeholder response. In the full implementation, this would be a streaming response from the Mistral API with relevant citations from the Nelson Textbook of Pediatrics.`,
        citations: [
          {
            id: '1',
            title: 'Nelson Textbook of Pediatrics',
            chapter: 'Chapter 23: Pediatric Assessment',
            page: 456,
            url: 'https://example.com/nelson-ch23',
            excerpt: 'Relevant excerpt from the textbook would appear here...'
          }
        ]
      })
    }, 1500)
  }

  const handleExampleClick = (prompt: string) => {
    setInput(prompt)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-ivory via-amber-50 to-medical-beige dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-20 w-32 h-32 bg-primary-200 rounded-full opacity-20"
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-24 h-24 bg-amber-200 rounded-full opacity-20"
          animate={{
            y: [0, 20, 0],
            scale: [1, 0.9, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <motion.div
        className="w-full max-w-4xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="flex items-center justify-center mb-4">
            <Stethoscope className="w-12 h-12 text-primary-500 mr-3" />
            <h1 className="text-5xl font-bold text-medical-text dark:text-white">
              Nelson-GPT
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 font-medium">
            Pediatric Knowledge at Your Fingertips
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Trusted Pediatric AI
          </p>
        </motion.div>

        {/* Main Input Container */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-3xl medical-shadow-lg p-8 mb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {/* Mode Toggle */}
          <div className="flex justify-center mb-6">
            <ModeToggle
              mode={selectedMode}
              onChange={setSelectedMode}
            />
          </div>

          {/* Input Area */}
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Nelson-GPT anything about pediatrics..."
              className="w-full h-32 p-6 text-lg border-none outline-none resize-none bg-transparent text-medical-text dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              maxLength={500}
            />
            
            {/* Character count */}
            <div className="absolute bottom-2 left-6 text-xs text-gray-400">
              {input.length}/500
            </div>

            {/* Send Button */}
            <motion.button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="absolute bottom-4 right-6 w-12 h-12 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Example Prompts */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Try these examples:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {examplePrompts.map((prompt, index) => (
              <motion.button
                key={index}
                onClick={() => handleExampleClick(prompt)}
                className="p-3 text-sm text-left bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 transition-all duration-200 hover:shadow-md"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                "{prompt}"
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
            <Stethoscope className="w-4 h-4 mr-2" />
            <span>
              Educational purposes only. Not a substitute for professional medical advice.
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

