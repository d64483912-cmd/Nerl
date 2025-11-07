import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, MoreVertical } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useChatStore } from '../store/chatStore'
import MessageBubble from './MessageBubble'
import InputDock from './InputDock'
import TypingIndicator from './TypingIndicator'

export default function ChatInterface() {
  const { currentChatId, setWelcomeMode, setCurrentChatId } = useAppStore()
  const { getChatById } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const currentChat = currentChatId ? getChatById(currentChatId) : null
  const isStreaming = currentChat?.messages.some(msg => msg.isStreaming) || false

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentChat?.messages])

  const handleBack = () => {
    setCurrentChatId(null)
    setWelcomeMode(true)
  }

  if (!currentChat) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">No chat selected</p>
          <button
            onClick={handleBack}
            className="mt-4 btn-primary"
          >
            Start New Chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-medical-ivory dark:bg-gray-900">
      {/* Header */}
      <motion.header
        className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mr-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-medical-text dark:text-white">
              {currentChat.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {currentChat.mode} mode
            </p>
          </div>
        </div>
        
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </motion.header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="max-w-4xl mx-auto">
          {currentChat.messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <MessageBubble message={message} />
            </motion.div>
          ))}
          
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TypingIndicator />
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Dock */}
      <InputDock />
    </div>
  )
}

