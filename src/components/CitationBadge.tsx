import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, FileText } from 'lucide-react'
import { Citation } from '../store/chatStore'

interface CitationBadgeProps {
  citation: Citation
}

export default function CitationBadge({ citation }: CitationBadgeProps) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="relative inline-block">
      <motion.button
        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs rounded-full hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <FileText className="w-3 h-3" />
        <span>{citation.chapter}</span>
      </motion.button>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4 z-50"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Citation Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-medical-text dark:text-white text-sm">
                  {citation.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {citation.chapter} • Page {citation.page}
                </p>
              </div>
              {citation.url && (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Open source"
                >
                  <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </a>
              )}
            </div>

            {/* Citation Excerpt */}
            {citation.excerpt && (
              <div className="border-l-2 border-primary-500 pl-3">
                <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                  "{citation.excerpt}"
                </p>
              </div>
            )}

            {/* Arrow pointer */}
            <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-200 dark:border-t-gray-600"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

