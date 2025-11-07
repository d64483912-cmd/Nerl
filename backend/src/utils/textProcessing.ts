// Text processing utilities for medical content
export interface TextChunk {
  content: string
  title?: string
  metadata?: Record<string, any>
  wordCount: number
  characterCount: number
}

export interface ChunkingOptions {
  maxChunkSize: number // Maximum characters per chunk
  minChunkSize: number // Minimum characters per chunk
  overlapSize: number  // Characters to overlap between chunks
  preserveParagraphs: boolean // Try to keep paragraphs intact
  preserveSentences: boolean  // Try to keep sentences intact
}

export class TextProcessor {
  private readonly defaultOptions: ChunkingOptions = {
    maxChunkSize: 1000,
    minChunkSize: 200,
    overlapSize: 100,
    preserveParagraphs: true,
    preserveSentences: true,
  }
  
  /**
   * Clean and normalize medical text
   */
  cleanText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters that might interfere with processing
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Trim
      .trim()
  }
  
  /**
   * Extract medical terms and keywords from text
   */
  extractMedicalKeywords(text: string): string[] {
    const medicalTermPatterns = [
      // Dosages and measurements
      /\b\d+\s*(mg|g|ml|l|mcg|kg|lb|cm|mm|inch|inches)\b/gi,
      // Medical conditions (simplified pattern)
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:syndrome|disease|disorder|condition))\b/g,
      // Drug names (capitalized words that might be medications)
      /\b[A-Z][a-z]+(?:ine|ol|ide|ate|ium|cin|zole|pril|sartan|statin)\b/g,
      // Medical procedures
      /\b(?:CT|MRI|X-ray|ultrasound|biopsy|surgery|procedure)\b/gi,
    ]
    
    const keywords = new Set<string>()
    
    for (const pattern of medicalTermPatterns) {
      const matches = text.match(pattern) || []
      matches.forEach(match => keywords.add(match.toLowerCase()))
    }
    
    return Array.from(keywords)
  }
  
  /**
   * Determine age groups mentioned in text
   */
  extractAgeGroups(text: string): string[] {
    const agePatterns = {
      neonate: /\b(?:neonate|newborn|birth|neonatal)\b/i,
      infant: /\b(?:infant|baby|babies|infantile)\b/i,
      toddler: /\b(?:toddler|toddlers)\b/i,
      child: /\b(?:child|children|pediatric|paediatric)\b/i,
      adolescent: /\b(?:adolescent|teenager|teen|puberty|adolescence)\b/i,
    }
    
    const ageGroups: string[] = []
    
    for (const [ageGroup, pattern] of Object.entries(agePatterns)) {
      if (pattern.test(text)) {
        ageGroups.push(ageGroup)
      }
    }
    
    return ageGroups
  }
  
  /**
   * Split text into chunks suitable for embedding
   */
  chunkText(text: string, options: Partial<ChunkingOptions> = {}): TextChunk[] {
    const opts = { ...this.defaultOptions, ...options }
    const cleanedText = this.cleanText(text)
    
    if (cleanedText.length <= opts.maxChunkSize) {
      return [{
        content: cleanedText,
        wordCount: this.countWords(cleanedText),
        characterCount: cleanedText.length,
      }]
    }
    
    const chunks: TextChunk[] = []
    let currentPosition = 0
    
    while (currentPosition < cleanedText.length) {
      let chunkEnd = Math.min(currentPosition + opts.maxChunkSize, cleanedText.length)
      
      // Try to end at a paragraph break
      if (opts.preserveParagraphs && chunkEnd < cleanedText.length) {
        const paragraphBreak = cleanedText.lastIndexOf('\n\n', chunkEnd)
        if (paragraphBreak > currentPosition + opts.minChunkSize) {
          chunkEnd = paragraphBreak
        }
      }
      
      // Try to end at a sentence break
      if (opts.preserveSentences && chunkEnd < cleanedText.length) {
        const sentenceBreak = cleanedText.lastIndexOf('. ', chunkEnd)
        if (sentenceBreak > currentPosition + opts.minChunkSize) {
          chunkEnd = sentenceBreak + 1
        }
      }
      
      // Extract the chunk
      const chunkContent = cleanedText.slice(currentPosition, chunkEnd).trim()
      
      if (chunkContent.length >= opts.minChunkSize) {
        chunks.push({
          content: chunkContent,
          wordCount: this.countWords(chunkContent),
          characterCount: chunkContent.length,
        })
      }
      
      // Move to next position with overlap
      currentPosition = Math.max(chunkEnd - opts.overlapSize, currentPosition + 1)
      
      // Prevent infinite loop
      if (currentPosition >= cleanedText.length) break
    }
    
    return chunks
  }
  
  /**
   * Count words in text
   */
  countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }
  
  /**
   * Extract title from content (first line or sentence)
   */
  extractTitle(content: string, maxLength: number = 100): string {
    const lines = content.split('\n')
    const firstLine = lines[0].trim()
    
    // If first line looks like a title (short and doesn't end with period)
    if (firstLine.length <= maxLength && !firstLine.endsWith('.')) {
      return firstLine
    }
    
    // Otherwise, use first sentence
    const firstSentence = content.split('.')[0].trim()
    if (firstSentence.length <= maxLength) {
      return firstSentence
    }
    
    // Fallback: truncate first line
    return firstLine.length > maxLength 
      ? firstLine.substring(0, maxLength - 3) + '...'
      : firstLine
  }
  
  /**
   * Determine medical specialty based on content
   */
  inferMedicalSpecialty(text: string): string[] {
    const specialtyKeywords = {
      cardiology: ['heart', 'cardiac', 'cardiovascular', 'arrhythmia', 'murmur', 'ecg', 'echo'],
      pulmonology: ['lung', 'respiratory', 'asthma', 'pneumonia', 'breathing', 'cough'],
      gastroenterology: ['stomach', 'intestine', 'digestive', 'diarrhea', 'vomiting', 'abdomen'],
      neurology: ['brain', 'neurological', 'seizure', 'headache', 'development', 'motor'],
      endocrinology: ['hormone', 'diabetes', 'growth', 'thyroid', 'insulin', 'metabolism'],
      nephrology: ['kidney', 'renal', 'urine', 'urinary', 'bladder', 'nephritis'],
      hematology_oncology: ['blood', 'anemia', 'cancer', 'leukemia', 'lymphoma', 'bleeding'],
      infectious_diseases: ['infection', 'fever', 'bacteria', 'virus', 'antibiotic', 'vaccine'],
      emergency_medicine: ['emergency', 'trauma', 'acute', 'urgent', 'critical', 'resuscitation'],
      neonatology: ['newborn', 'neonate', 'premature', 'birth', 'delivery', 'nicu'],
    }
    
    const lowerText = text.toLowerCase()
    const specialties: string[] = []
    
    for (const [specialty, keywords] of Object.entries(specialtyKeywords)) {
      const matchCount = keywords.filter(keyword => lowerText.includes(keyword)).length
      if (matchCount >= 2) { // Require at least 2 keyword matches
        specialties.push(specialty)
      }
    }
    
    return specialties.length > 0 ? specialties : ['general_pediatrics']
  }
  
  /**
   * Sanitize text for database storage
   */
  sanitizeForDatabase(text: string): string {
    return text
      // Remove null bytes
      .replace(/\0/g, '')
      // Limit length to prevent database issues
      .substring(0, 50000)
      // Ensure valid UTF-8
      .replace(/[\uD800-\uDFFF]/g, '')
  }
}

// Singleton instance
export const textProcessor = new TextProcessor()

// Export convenience functions
export function cleanText(text: string): string {
  return textProcessor.cleanText(text)
}

export function chunkText(text: string, options?: Partial<ChunkingOptions>): TextChunk[] {
  return textProcessor.chunkText(text, options)
}

export function extractMedicalKeywords(text: string): string[] {
  return textProcessor.extractMedicalKeywords(text)
}

export function extractAgeGroups(text: string): string[] {
  return textProcessor.extractAgeGroups(text)
}

export function inferMedicalSpecialty(text: string): string[] {
  return textProcessor.inferMedicalSpecialty(text)
}

