import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Clock, Settings, User } from 'lucide-react'

type TabType = 'chat' | 'history' | 'settings' | 'profile'

const tabs = [
  { id: 'chat' as TabType, icon: MessageCircle, label: 'Chat' },
  { id: 'history' as TabType, icon: Clock, label: 'History' },
  { id: 'settings' as TabType, icon: Settings, label: 'Settings' },
  { id: 'profile' as TabType, icon: User, label: 'Profile' },
]

export default function FooterNavigation() {
  const [activeTab, setActiveTab] = useState<TabType>('chat')

  return (
    <motion.nav
      className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {isActive && (
                    <motion.div
                      className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary-500 rounded-full"
                      layoutId="activeIndicator"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
                <span className="text-xs font-medium">
                  {tab.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.nav>
  )
}

