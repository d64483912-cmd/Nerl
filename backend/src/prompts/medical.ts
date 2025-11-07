// Medical prompt templates for Nelson-GPT
export interface PromptContext {
  query: string
  context: string
  mode: 'academic' | 'clinical'
  sessionHistory?: string
  userAge?: string
  specialty?: string
}

export class MedicalPromptBuilder {
  private readonly medicalDisclaimer = `
IMPORTANT MEDICAL DISCLAIMER: This information is for educational purposes only and should not replace professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals for medical decisions. In emergency situations, seek immediate medical attention.`
  
  private readonly citationFormat = `
When referencing information, use this format: [Nelson, Ch. X, p. Y] where X is the chapter number and Y is the page number.`
  
  /**
   * Build system prompt based on mode
   */
  buildSystemPrompt(mode: 'academic' | 'clinical'): string {
    const baseInstructions = `You are Nelson-GPT, an AI assistant specialized in pediatric medicine based on the Nelson Textbook of Pediatrics. You provide evidence-based information to healthcare professionals, medical students, and researchers.

CORE PRINCIPLES:
- Base all responses on the provided medical literature from Nelson Textbook of Pediatrics
- Maintain professional medical terminology and accuracy
- Include relevant citations in the format [Nelson, Ch. X, p. Y]
- Acknowledge limitations and recommend consulting healthcare professionals
- Never provide definitive diagnoses - always suggest clinical evaluation
- Focus on pediatric-specific considerations (age-appropriate care)

${this.medicalDisclaimer}
${this.citationFormat}`
    
    if (mode === 'academic') {
      return `${baseInstructions}

ACADEMIC MODE INSTRUCTIONS:
- Provide comprehensive, textbook-style explanations
- Include pathophysiology and underlying mechanisms when relevant
- Reference multiple sources when available
- Use detailed medical terminology
- Structure responses with clear headings and bullet points
- Include differential diagnoses and clinical considerations
- Emphasize learning objectives and key concepts`
    } else {
      return `${baseInstructions}

CLINICAL MODE INSTRUCTIONS:
- Focus on practical, actionable clinical guidance
- Prioritize diagnostic approaches and treatment considerations
- Provide clear differential diagnoses with supporting evidence
- Include red flags and when to escalate care
- Suggest appropriate next steps and follow-up
- Consider resource limitations and practical constraints
- Emphasize patient safety and evidence-based practice`
    }
  }
  
  /**
   * Build user prompt with context
   */
  buildUserPrompt(context: PromptContext): string {
    const contextSection = context.context 
      ? `MEDICAL CONTEXT FROM NELSON TEXTBOOK:\n${context.context}\n\n`
      : 'No specific context found in Nelson Textbook for this query.\n\n'
    
    const modeInstruction = context.mode === 'academic'
      ? 'Please provide a comprehensive, educational response suitable for medical learning.'
      : 'Please provide practical clinical guidance for healthcare decision-making.'
    
    return `${contextSection}QUERY: ${context.query}

${modeInstruction}

Please structure your response with:
1. Direct answer to the query
2. Supporting evidence from Nelson Textbook (with citations)
3. Clinical considerations or learning points
4. When to seek additional consultation if applicable`
  }
  
  /**
   * Build follow-up prompt for continuing conversations
   */
  buildFollowUpPrompt(context: PromptContext): string {
    const previousContext = context.sessionHistory 
      ? `PREVIOUS CONVERSATION CONTEXT:\n${context.sessionHistory}\n\n`
      : ''
    
    const newContext = context.context
      ? `ADDITIONAL MEDICAL CONTEXT:\n${context.context}\n\n`
      : ''
    
    return `${previousContext}${newContext}FOLLOW-UP QUERY: ${context.query}

Please provide a response that builds on our previous discussion while incorporating any new relevant information from the Nelson Textbook.`
  }
  
  /**
   * Build age-specific prompt
   */
  buildAgeSpecificPrompt(context: PromptContext & { ageGroup: string }): string {
    const ageConsiderations = {
      neonate: 'Focus on neonatal-specific physiology, common neonatal conditions, and age-appropriate assessment techniques.',
      infant: 'Consider infant development, feeding issues, immunization schedules, and growth patterns.',
      child: 'Include school-age considerations, developmental milestones, and age-appropriate communication.',
      adolescent: 'Address adolescent-specific health issues, confidentiality considerations, and transition to adult care.'
    }
    
    const ageGuidance = ageConsiderations[context.ageGroup as keyof typeof ageConsiderations] || 
      'Consider age-appropriate assessment and management approaches.'
    
    return `${this.buildUserPrompt(context)}

AGE-SPECIFIC CONSIDERATIONS FOR ${context.ageGroup.toUpperCase()}:
${ageGuidance}

Please tailor your response specifically for this age group, including:
- Age-appropriate normal values and ranges
- Developmental considerations
- Age-specific risk factors
- Appropriate diagnostic approaches for this age
- Treatment modifications based on age`
  }
  
  /**
   * Build emergency/urgent care prompt
   */
  buildEmergencyPrompt(context: PromptContext): string {
    return `${this.buildUserPrompt(context)}

EMERGENCY/URGENT CARE FOCUS:
This query appears to involve urgent or emergency pediatric care. Please structure your response to include:

1. IMMEDIATE ASSESSMENT PRIORITIES:
   - Critical signs to evaluate immediately
   - Life-threatening conditions to rule out
   - Triage considerations

2. INITIAL MANAGEMENT:
   - Immediate interventions if indicated
   - Stabilization measures
   - When to activate emergency protocols

3. DIAGNOSTIC APPROACH:
   - Essential immediate tests/evaluations
   - Time-sensitive diagnostic considerations

4. DISPOSITION AND FOLLOW-UP:
   - When to seek emergency care
   - Admission criteria
   - Follow-up requirements

Remember: In true emergencies, immediate medical attention takes precedence over any AI guidance.`
  }
  
  /**
   * Build differential diagnosis prompt
   */
  buildDifferentialPrompt(context: PromptContext): string {
    return `${this.buildUserPrompt(context)}

DIFFERENTIAL DIAGNOSIS FOCUS:
Please provide a structured differential diagnosis approach:

1. MOST LIKELY DIAGNOSES:
   - List 3-5 most probable diagnoses with supporting evidence
   - Include prevalence in pediatric populations

2. MUST-NOT-MISS CONDITIONS:
   - Serious conditions that must be considered
   - Red flags that would suggest these conditions

3. ADDITIONAL CONSIDERATIONS:
   - Less common but possible diagnoses
   - Age-specific considerations

4. DIAGNOSTIC APPROACH:
   - Recommended history and physical exam findings
   - Appropriate diagnostic tests
   - Clinical decision-making tools if available

Structure each diagnosis with: Condition name, supporting evidence, key features, and diagnostic approach.`
  }
  
  /**
   * Build medication/treatment prompt
   */
  buildMedicationPrompt(context: PromptContext): string {
    return `${this.buildUserPrompt(context)}

MEDICATION/TREATMENT FOCUS:
Please provide comprehensive medication and treatment guidance:

1. MEDICATION INFORMATION:
   - Generic and brand names
   - Mechanism of action
   - Pediatric dosing (age/weight-based)
   - Available formulations

2. SAFETY CONSIDERATIONS:
   - Contraindications in pediatric patients
   - Age-specific precautions
   - Drug interactions
   - Monitoring requirements

3. ADMINISTRATION:
   - Route of administration
   - Timing and frequency
   - Special administration considerations

4. PATIENT/FAMILY EDUCATION:
   - Key counseling points
   - Expected effects and timeline
   - When to contact healthcare provider

${this.medicalDisclaimer}

Note: All medication dosing should be verified with current pediatric references and adjusted for individual patient factors.`
  }
  
  /**
   * Get follow-up question suggestions
   */
  getFollowUpSuggestions(query: string, mode: 'academic' | 'clinical'): string[] {
    const academicSuggestions = [
      'What is the pathophysiology behind this condition?',
      'How does this condition differ in pediatric vs adult populations?',
      'What are the latest research findings on this topic?',
      'Can you explain the developmental considerations?'
    ]
    
    const clinicalSuggestions = [
      'What are the key differential diagnoses to consider?',
      'When should I refer to a specialist?',
      'What are the red flags I should watch for?',
      'How do I counsel families about this condition?'
    ]
    
    return mode === 'academic' ? academicSuggestions : clinicalSuggestions
  }
  
  /**
   * Format citations for display
   */
  formatCitations(sources: Array<{ chapterTitle: string; pageStart: number }>): string {
    if (sources.length === 0) return ''
    
    const citations = sources.map((source, index) => 
      `${index + 1}. ${source.chapterTitle}, Nelson Textbook of Pediatrics, p. ${source.pageStart}`
    ).join('\n')
    
    return `\n\nREFERENCES:\n${citations}`
  }
}

// Singleton instance
export const medicalPromptBuilder = new MedicalPromptBuilder()

// Export convenience functions
export function buildSystemPrompt(mode: 'academic' | 'clinical'): string {
  return medicalPromptBuilder.buildSystemPrompt(mode)
}

export function buildUserPrompt(context: PromptContext): string {
  return medicalPromptBuilder.buildUserPrompt(context)
}

