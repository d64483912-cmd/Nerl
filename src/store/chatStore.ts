import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Citation {
  id: string
  title: string
  chapter: string
  page: number
  url: string
  excerpt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  citations?: Citation[]
  isStreaming?: boolean
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  mode: 'academic' | 'clinical'
  createdAt: Date
  updatedAt: Date
  isPinned: boolean
}

interface ChatState {
  chats: Chat[]
  currentMode: 'academic' | 'clinical'
  
  // Actions
  createChat: (mode: 'academic' | 'clinical') => string
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => void
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void
  deleteChat: (chatId: string) => void
  pinChat: (chatId: string) => void
  unpinChat: (chatId: string) => void
  renameChat: (chatId: string, title: string) => void
  clearMessages: (chatId: string) => void
  setCurrentMode: (mode: 'academic' | 'clinical') => void
  getChatById: (chatId: string) => Chat | undefined
}

const generateId = () => Math.random().toString(36).substr(2, 9)

const generateChatTitle = (firstMessage: string): string => {
  // Generate a title from the first user message
  const words = firstMessage.trim().split(' ').slice(0, 6)
  return words.join(' ') + (firstMessage.split(' ').length > 6 ? '...' : '')
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      currentMode: 'academic',
      
      createChat: (mode) => {
        const chatId = generateId()
        const newChat: Chat = {
          id: chatId,
          title: 'Untitled',
          messages: [],
          mode,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
        }
        
        set((state) => ({
          chats: [newChat, ...state.chats],
          currentMode: mode,
        }))
        
        return chatId
      },
      
      addMessage: (chatId, messageData) => {
        const message: Message = {
          ...messageData,
          id: generateId(),
          timestamp: new Date(),
        }
        
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id === chatId) {
              const updatedMessages = [...chat.messages, message]
              
              // Auto-generate title from first user message
              let title = chat.title
              if (title === 'Untitled' && message.role === 'user' && updatedMessages.length === 1) {
                title = generateChatTitle(message.content)
              }
              
              return {
                ...chat,
                messages: updatedMessages,
                title,
                updatedAt: new Date(),
              }
            }
            return chat
          }),
        }))
      },
      
      updateMessage: (chatId, messageId, updates) => {
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id === chatId) {
              return {
                ...chat,
                messages: chat.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, ...updates } : msg
                ),
                updatedAt: new Date(),
              }
            }
            return chat
          }),
        }))
      },
      
      deleteChat: (chatId) => {
        set((state) => ({
          chats: state.chats.filter((chat) => chat.id !== chatId),
        }))
      },
      
      pinChat: (chatId) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId ? { ...chat, isPinned: true } : chat
          ),
        }))
      },
      
      unpinChat: (chatId) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId ? { ...chat, isPinned: false } : chat
          ),
        }))
      },
      
      renameChat: (chatId, title) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId ? { ...chat, title, updatedAt: new Date() } : chat
          ),
        }))
      },
      
      clearMessages: (chatId) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, messages: [], updatedAt: new Date() }
              : chat
          ),
        }))
      },
      
      setCurrentMode: (mode) => {
        set({ currentMode: mode })
      },
      
      getChatById: (chatId) => {
        return get().chats.find((chat) => chat.id === chatId)
      },
    }),
    {
      name: 'nelson-gpt-chat-store',
    }
  )
)

