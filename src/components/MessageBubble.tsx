import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Bot, User } from 'lucide-react'
import { Message } from '../store/chatStore'
import MarkdownRenderer from './MarkdownRenderer'
import CitationBadge from './CitationBadge'

interface MessageBubbleProps {
  message: Message
}

const followUpSuggestions = [
  "Tell me more about this",
  "What are the treatment options?",
  "Are there any complications?",
  "What should I monitor for?",
]

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start max-w-[85%] gap-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-primary-500 text-white' 
            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
        }`}>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4 text-primary-500" />
          )}
        </div>

        {/* Message Content */}
        <motion.div
          className={`message-bubble ${isUser ? 'message-user' : 'message-ai'}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Message Text */}
          <div className="mb-2">
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </div>

          {/* Citations */}
          {message.citations && message.citations.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.citations.map((citation) => (
                <CitationBadge key={citation.id} citation={citation} />
              ))}
            </div>
          )}

          {/* Message Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <span>{formatTime(message.timestamp)}</span>
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Follow-up suggestions for AI messages */}
      {!isUser && (
        <motion.div
          className="mt-2 flex flex-wrap gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          {followUpSuggestions.slice(0, 2).map((suggestion, index) => (
            <button
              key={index}
              className="px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-primary-200 dark:border-gray-600 text-primary-600 dark:text-primary-400 rounded-full hover:bg-primary-50 dark:hover:bg-gray-600 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

