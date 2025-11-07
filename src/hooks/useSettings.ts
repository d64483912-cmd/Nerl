import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  theme: 'light' | 'dark'
  fontSize: 'small' | 'medium' | 'large'
  aiStyle: 'concise' | 'detailed' | 'evidence-heavy'
  showDisclaimers: boolean
  voiceEnabled: boolean
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void
  setAiStyle: (style: 'concise' | 'detailed' | 'evidence-heavy') => void
  setShowDisclaimers: (show: boolean) => void
  setVoiceEnabled: (enabled: boolean) => void
  toggleTheme: () => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      fontSize: 'medium',
      aiStyle: 'detailed',
      showDisclaimers: true,
      voiceEnabled: false,
      
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setAiStyle: (aiStyle) => set({ aiStyle }),
      setShowDisclaimers: (showDisclaimers) => set({ showDisclaimers }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      
      toggleTheme: () => {
        const currentTheme = get().theme
        set({ theme: currentTheme === 'light' ? 'dark' : 'light' })
      },
    }),
    {
      name: 'nelson-gpt-settings',
    }
  )
)

