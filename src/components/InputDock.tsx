import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Mic, Square } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useChatStore } from '../store/chatStore'
import { useSettings } from '../hooks/useSettings'
import ModeToggle from './ModeToggle'

export default function InputDock() {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { currentChatId } = useAppStore()
  const { addMessage, currentMode, setCurrentMode, getChatById } = useChatStore()
  const { voiceEnabled, showDisclaimers } = useSettings()

  const currentChat = currentChatId ? getChatById(currentChatId) : null
  const maxLength = 1000

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 80)}px`
    }
  }, [input])

  const handleSubmit = async () => {
    if (!input.trim() || !currentChatId || isStreaming) return

    const userMessage = input.trim()
    setInput('')
    setIsStreaming(true)

    // Add user message
    addMessage(currentChatId, {
      role: 'user',
      content: userMessage,
    })

    // Simulate AI response (placeholder)
    setTimeout(() => {
      addMessage(currentChatId, {
        role: 'assistant',
        content: `Thank you for your question about "${userMessage}". This is a placeholder response in ${currentMode} mode. In the full implementation, this would be a streaming response from the Mistral API with relevant citations from the Nelson Textbook of Pediatrics.

**Key Points:**
- This would contain evidence-based pediatric information
- Citations would link to specific chapters and pages
- Response style would adapt based on ${currentMode} mode selection

*Please note: This is for educational purposes only and not a substitute for professional medical advice.*`,
        citations: [
          {
            id: '1',
            title: 'Nelson Textbook of Pediatrics',
            chapter: 'Chapter 15: Clinical Assessment',
            page: 234,
            url: 'https://example.com/nelson-ch15',
            excerpt: 'Relevant medical information would be extracted from the textbook...'
          }
        ]
      })
      setIsStreaming(false)
    }, 2000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleStop = () => {
    setIsStreaming(false)
  }

  if (!currentChat) return null

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Mode Toggle */}
        <div className="flex justify-center mb-3">
          <ModeToggle
            mode={currentMode}
            onChange={setCurrentMode}
          />
        </div>

        {/* Input Container */}
        <div className="relative bg-gray-50 dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-all duration-200">
          <div className="flex items-end gap-3 p-4">
            {/* Voice Input Button */}
            {voiceEnabled && (
              <button
                className="flex-shrink-0 p-2 text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                title="Voice input"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about pediatric conditions, treatments, or guidelines..."
                className="w-full min-h-[44px] max-h-20 px-0 py-2 bg-transparent border-none outline-none resize-none text-medical-text dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                maxLength={maxLength}
                disabled={isStreaming}
              />
              
              {/* Character count */}
              <div className="absolute -bottom-1 right-0 text-xs text-gray-400">
                {input.length}/{maxLength}
              </div>
            </div>

            {/* Send/Stop Button */}
            <div className="flex-shrink-0">
              {isStreaming ? (
                <motion.button
                  onClick={handleStop}
                  className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Stop generation"
                >
                  <Square className="w-4 h-4" />
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  className="w-10 h-10 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors"
                  whileHover={{ scale: input.trim() ? 1.05 : 1 }}
                  whileTap={{ scale: input.trim() ? 0.95 : 1 }}
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        {showDisclaimers && (
          <motion.p
            className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Educational purposes only. Always consult healthcare professionals for medical decisions.
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}

