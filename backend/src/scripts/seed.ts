#!/usr/bin/env tsx

import { config } from '../config/index.js'
import { migrationManager } from '../db/migrations.js'
import { query } from '../db/connection.js'
import { generateEmbedding } from '../services/embeddings.js'
import { textProcessor } from '../utils/textProcessing.js'
import { logger } from '../utils/logger.js'

// Sample Nelson Textbook content for development and testing
const sampleContent = [
  {
    title: 'Fever in Infants and Children',
    content: `Fever is one of the most common presenting symptoms in pediatric practice and is defined as a rectal temperature ≥38.0°C (100.4°F), oral temperature ≥37.8°C (100.0°F), or axillary temperature ≥37.2°C (99.0°F). The approach to fever varies significantly based on the age of the child, with special considerations for neonates and young infants.

In neonates (0-28 days), fever is particularly concerning as their immune systems are immature and they may not mount typical inflammatory responses. Any fever in a neonate warrants immediate medical evaluation and often hospitalization for sepsis workup.

For infants 1-3 months old, fever evaluation follows specific protocols including complete blood count, blood cultures, urinalysis, and lumbar puncture in many cases. The Rochester criteria and other clinical decision rules help guide management.

In older infants and children, the approach to fever focuses on identifying the source and assessing for serious bacterial infections. The presence of focal signs, degree of toxicity, and response to antipyretics all factor into clinical decision-making.

Antipyretic therapy with acetaminophen or ibuprofen can provide comfort but does not change the underlying disease course. Parents should be educated about appropriate dosing and the importance of seeking medical care for concerning symptoms.`,
    chapterNumber: 181,
    chapterTitle: 'Fever Without a Focus',
    contentType: 'section' as const,
    medicalSpecialty: ['general_pediatrics', 'infectious_diseases'] as const,
    ageGroups: ['neonate', 'infant', 'child']
  },
  {
    title: 'Normal Growth and Development',
    content: `Normal child development follows predictable patterns, though there is considerable individual variation in the timing of milestones. Understanding these patterns is essential for pediatric care and early identification of developmental delays.

Motor Development:
- 2 months: Lifts head when prone, follows objects with eyes
- 4 months: Rolls from prone to supine, sits with support
- 6 months: Sits without support, transfers objects hand to hand
- 9 months: Crawls, pulls to stand, pincer grasp emerges
- 12 months: Walks independently, throws objects
- 18 months: Runs, climbs stairs, scribbles with crayon
- 24 months: Jumps, kicks ball, builds tower of 6 blocks

Language Development:
- 2 months: Social smile, coos
- 6 months: Babbles, responds to name
- 9 months: Says "mama" and "dada" specifically
- 12 months: First words, follows simple commands
- 18 months: Vocabulary of 10-25 words, points to body parts
- 24 months: Two-word phrases, vocabulary of 50+ words

Social-Emotional Development:
- 2 months: Social smile
- 6 months: Stranger anxiety begins
- 12 months: Separation anxiety, waves bye-bye
- 18 months: Parallel play, temper tantrums
- 24 months: Begins cooperative play, shows empathy

Red flags for developmental delay include loss of previously acquired skills, lack of social smile by 3 months, no babbling by 12 months, no words by 18 months, or no two-word phrases by 24 months.`,
    chapterNumber: 12,
    chapterTitle: 'Child Development and Behavior',
    contentType: 'section' as const,
    medicalSpecialty: ['developmental_pediatrics', 'general_pediatrics'] as const,
    ageGroups: ['infant', 'child']
  },
  {
    title: 'Neonatal Resuscitation',
    content: `Neonatal resuscitation is a critical skill required in delivery rooms and neonatal intensive care units. The vast majority of newborns transition successfully to extrauterine life without intervention, but approximately 10% require some assistance, and 1% need extensive resuscitation.

The initial steps of neonatal resuscitation include:
1. Provide warmth and clear airway if needed
2. Dry and stimulate the infant
3. Assess breathing and heart rate

If the infant is not breathing or has gasping respirations, positive pressure ventilation should be initiated immediately. The most important and effective intervention in neonatal resuscitation is establishing effective ventilation.

Heart rate assessment is crucial:
- >100 bpm: Continue supportive care
- 60-100 bpm: Continue PPV, consider CPAP
- <60 bpm: Begin chest compressions with PPV

Chest compressions should be performed using the two-thumb technique with hands encircling the chest. The compression-to-ventilation ratio is 3:1 in neonates.

Epinephrine is indicated if the heart rate remains <60 bpm despite adequate ventilation and chest compressions for 60 seconds. The dose is 0.01-0.03 mg/kg IV or 0.05-0.1 mg/kg via endotracheal tube.

Volume expansion with normal saline (10 ml/kg) may be considered in cases of suspected blood loss or shock that does not respond to other measures.

The decision to discontinue resuscitation efforts is complex and should consider factors such as gestational age, duration of resuscitation, and response to interventions.`,
    chapterNumber: 103,
    chapterTitle: 'Delivery Room and Immediate Postnatal Care',
    contentType: 'section' as const,
    medicalSpecialty: ['neonatology', 'emergency_medicine'] as const,
    ageGroups: ['neonate']
  },
  {
    title: 'Asthma in Children',
    content: `Asthma is the most common chronic disease of childhood, affecting approximately 8-10% of children in the United States. It is characterized by chronic airway inflammation, variable airflow obstruction, and bronchial hyperresponsiveness.

Pathophysiology involves complex interactions between genetic predisposition and environmental factors. The inflammatory cascade includes mast cells, eosinophils, T-helper cells, and various inflammatory mediators including leukotrienes, histamine, and cytokines.

Clinical presentation varies by age:
- Infants: Recurrent wheezing, cough, feeding difficulties
- Preschoolers: Wheezing with viral infections, exercise intolerance
- School-age: Classic triad of wheezing, cough, and dyspnea

Diagnosis is primarily clinical in young children, as pulmonary function tests are difficult to perform reliably before age 5-6 years. In older children, spirometry showing reversible airway obstruction supports the diagnosis.

Asthma severity classification:
- Intermittent: Symptoms ≤2 days/week, nighttime awakening ≤2x/month
- Mild persistent: Symptoms >2 days/week but not daily
- Moderate persistent: Daily symptoms, nighttime awakening >1x/week
- Severe persistent: Symptoms throughout the day, frequent nighttime awakening

Treatment follows a stepwise approach:
Step 1: Short-acting beta-agonist as needed
Step 2: Low-dose inhaled corticosteroid
Step 3: Medium-dose ICS or low-dose ICS + LABA
Step 4: Medium-dose ICS + LABA
Step 5: High-dose ICS + LABA, consider omalizumab

Environmental control measures include avoiding triggers such as allergens, tobacco smoke, and air pollution. Patient and family education about proper inhaler technique and asthma action plans is essential.`,
    chapterNumber: 150,
    chapterTitle: 'Asthma',
    contentType: 'section' as const,
    medicalSpecialty: ['pulmonology', 'general_pediatrics'] as const,
    ageGroups: ['infant', 'child', 'adolescent']
  },
  {
    title: 'Congenital Heart Disease Overview',
    content: `Congenital heart disease (CHD) occurs in approximately 8-10 per 1000 live births, making it the most common birth defect. CHD encompasses a wide spectrum of structural abnormalities of the heart and great vessels present at birth.

Classification of CHD:
1. Acyanotic lesions (left-to-right shunts):
   - Ventricular septal defect (VSD) - most common
   - Atrial septal defect (ASD)
   - Patent ductus arteriosus (PDA)
   - Atrioventricular septal defect

2. Cyanotic lesions:
   - Tetralogy of Fallot - most common cyanotic lesion
   - Transposition of great arteries
   - Tricuspid atresia
   - Hypoplastic left heart syndrome

3. Obstructive lesions:
   - Coarctation of aorta
   - Aortic stenosis
   - Pulmonary stenosis

Clinical presentation varies by lesion type and severity:
- Heart failure symptoms: Poor feeding, failure to thrive, tachypnea
- Cyanosis: Central cyanosis, clubbing, hypercyanotic spells
- Murmurs: May be innocent or pathologic

Diagnostic evaluation includes:
- Echocardiography: Primary diagnostic tool
- Chest X-ray: Assess heart size and pulmonary vascularity
- ECG: Evaluate rhythm and chamber enlargement
- Pulse oximetry: Screen for cyanosis
- Cardiac catheterization: For complex lesions requiring intervention

Management principles:
- Medical management of heart failure with diuretics, ACE inhibitors
- Nutritional support and growth monitoring
- Prophylaxis against respiratory syncytial virus (RSV)
- Timing of surgical intervention based on lesion type and severity
- Long-term cardiology follow-up

Prognosis has improved dramatically with advances in pediatric cardiac surgery and interventional cardiology. Many children with CHD now survive to adulthood and require transition to adult congenital heart disease specialists.`,
    chapterNumber: 433,
    chapterTitle: 'Congenital Heart Disease',
    contentType: 'section' as const,
    medicalSpecialty: ['cardiology', 'general_pediatrics'] as const,
    ageGroups: ['neonate', 'infant', 'child', 'adolescent']
  }
]

async function seedDatabase() {
  try {
    logger.info('Starting database seeding process...')
    
    // Check if database is ready
    const health = await migrationManager.checkDatabaseHealth()
    if (!health.connected || !health.tablesExist) {
      throw new Error('Database is not ready. Please run migrations first.')
    }
    
    // Check if we already have content
    const existingResult = await query('SELECT COUNT(*) FROM document_chunks')
    const existingCount = parseInt(existingResult.rows[0].count)
    
    if (existingCount > 0) {
      logger.info(`Database already contains ${existingCount} document chunks`)
      const shouldContinue = process.argv.includes('--force')
      
      if (!shouldContinue) {
        logger.info('Use --force flag to add more content to existing database')
        return
      }
    }
    
    logger.info(`Processing ${sampleContent.length} sample documents...`)
    
    let processedCount = 0
    let errorCount = 0
    
    for (const doc of sampleContent) {
      try {
        logger.info(`Processing: ${doc.title}`)
        
        // Clean and process text
        const cleanedContent = textProcessor.cleanText(doc.content)
        const keywords = textProcessor.extractMedicalKeywords(cleanedContent)
        const inferredSpecialties = textProcessor.inferMedicalSpecialty(cleanedContent)
        
        // Use provided specialties or inferred ones
        const finalSpecialties = doc.medicalSpecialty.length > 0 
          ? doc.medicalSpecialty 
          : inferredSpecialties
        
        // Generate embedding
        logger.debug(`Generating embedding for: ${doc.title}`)
        const embeddingResult = await generateEmbedding(cleanedContent)
        
        // Calculate metrics
        const wordCount = textProcessor.countWords(cleanedContent)
        const characterCount = cleanedContent.length
        
        // Insert into database
        await query(`
          INSERT INTO document_chunks (
            title, content, content_type, chapter_number, chapter_title,
            medical_specialty, keywords, age_groups, embedding,
            word_count, character_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          doc.title,
          cleanedContent,
          doc.contentType,
          doc.chapterNumber,
          doc.chapterTitle,
          finalSpecialties,
          keywords,
          doc.ageGroups,
          `[${embeddingResult.embedding.join(',')}]`, // PostgreSQL vector format
          wordCount,
          characterCount
        ])
        
        processedCount++
        logger.info(`✅ Processed: ${doc.title} (${wordCount} words, ${embeddingResult.embedding.length} dims)`)
        
      } catch (error) {
        errorCount++
        logger.error(`❌ Failed to process: ${doc.title}`, {}, error as Error)
      }
    }
    
    logger.info('Database seeding completed', {
      totalDocuments: sampleContent.length,
      processedCount,
      errorCount,
      successRate: `${Math.round((processedCount / sampleContent.length) * 100)}%`
    })
    
    // Verify the data
    const finalResult = await query('SELECT COUNT(*) FROM document_chunks')
    const finalCount = parseInt(finalResult.rows[0].count)
    
    logger.info(`Database now contains ${finalCount} document chunks`)
    
    // Test a sample search
    logger.info('Testing vector search...')
    const testResult = await query(`
      SELECT title, (1 - (embedding <=> $1::vector)) as similarity
      FROM document_chunks
      ORDER BY embedding <=> $1::vector
      LIMIT 3
    `, [`[${embeddingResult.embedding.join(',')}]`])
    
    logger.info('Sample search results:')
    testResult.rows.forEach((row, index) => {
      logger.info(`${index + 1}. ${row.title} (similarity: ${row.similarity.toFixed(3)})`)
    })
    
  } catch (error) {
    logger.error('Database seeding failed', {}, error as Error)
    process.exit(1)
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding process completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Seeding process failed', {}, error)
      process.exit(1)
    })
}

export { seedDatabase }

