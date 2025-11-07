import { useAppStore } from './store/appStore'
import WelcomeScreen from './components/WelcomeScreen'
import ChatInterface from './components/ChatInterface'
import FooterNavigation from './components/FooterNavigation'
import { useSettings } from './hooks/useSettings'
import { useEffect } from 'react'

function App() {
  const { isWelcomeMode } = useAppStore()
  const { theme } = useSettings()

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="min-h-screen bg-medical-ivory dark:bg-gray-900 transition-colors duration-200">
      {isWelcomeMode ? (
        <WelcomeScreen />
      ) : (
        <div className="flex flex-col h-screen">
          <div className="flex-1 overflow-hidden">
            <ChatInterface />
          </div>
          <FooterNavigation />
        </div>
      )}
    </div>
  )
}

export default App

