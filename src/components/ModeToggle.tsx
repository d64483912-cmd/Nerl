import { motion } from 'framer-motion'
import { GraduationCap, Stethoscope } from 'lucide-react'

interface ModeToggleProps {
  mode: 'academic' | 'clinical'
  onChange: (mode: 'academic' | 'clinical') => void
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
      <motion.button
        onClick={() => onChange('academic')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          mode === 'academic'
            ? 'bg-primary-500 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <GraduationCap className="w-4 h-4" />
        Academic
      </motion.button>
      
      <motion.button
        onClick={() => onChange('clinical')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          mode === 'clinical'
            ? 'bg-green-500 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Stethoscope className="w-4 h-4" />
        Clinical
      </motion.button>
    </div>
  )
}

