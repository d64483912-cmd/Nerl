import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom heading styles
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-medical-text dark:text-white mb-3 mt-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-medical-text dark:text-white mb-2 mt-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-medical-text dark:text-white mb-2 mt-3">
              {children}
            </h3>
          ),
          
          // Custom paragraph styles
          p: ({ children }) => (
            <p className="text-medical-text dark:text-gray-100 mb-3 leading-relaxed">
              {children}
            </p>
          ),
          
          // Custom list styles
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 text-medical-text dark:text-gray-100">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 text-medical-text dark:text-gray-100">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-medical-text dark:text-gray-100">
              {children}
            </li>
          ),
          
          // Custom table styles
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-200 dark:border-gray-600 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-gray-700">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-medical-text dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
              {children}
            </td>
          ),
          
          // Custom code styles
          code: ({ inline, children }) => (
            inline ? (
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400 rounded text-sm font-mono">
                {children}
              </code>
            ) : (
              <code className="block p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono overflow-x-auto">
                {children}
              </code>
            )
          ),
          
          // Custom blockquote styles (for medical dosages)
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary-500 pl-4 py-2 bg-primary-50 dark:bg-gray-800 rounded-r-lg mb-3">
              <div className="text-medical-text dark:text-gray-100 font-mono text-sm">
                {children}
              </div>
            </blockquote>
          ),
          
          // Custom link styles
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline"
            >
              {children}
            </a>
          ),
          
          // Custom strong/emphasis styles
          strong: ({ children }) => (
            <strong className="font-semibold text-medical-text dark:text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-medical-text dark:text-gray-100">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

