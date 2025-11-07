import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  isWelcomeMode: boolean
  currentChatId: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setWelcomeMode: (mode: boolean) => void
  setCurrentChatId: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isWelcomeMode: true,
      currentChatId: null,
      isLoading: false,
      error: null,
      
      setWelcomeMode: (mode) => set({ isWelcomeMode: mode }),
      setCurrentChatId: (id) => set({ currentChatId: id }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'nelson-gpt-app-store',
      partialize: (state) => ({
        isWelcomeMode: state.isWelcomeMode,
        currentChatId: state.currentChatId,
      }),
    }
  )
)

