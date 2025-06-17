
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, documentId, userId } = await req.json()
    
    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Skip very short texts to avoid over-analysis
    if (text.trim().length < 10) {
      return new Response(
        JSON.stringify([]),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY environment variable is not set')
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in Edge Function Secrets.' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Processing text for grammar check:', text.substring(0, 100) + '...')

    // Enhanced prompt for comprehensive grammar checking like Grammarly
    const prompt = `You are a professional grammar checker exactly like Grammarly. Analyze this text THOROUGHLY and find ALL grammatical errors, spelling mistakes, punctuation issues, and word choice problems.

TEXT TO ANALYZE: "${text}"

Find and correct these types of errors:
1. GRAMMAR ERRORS: verb tense errors, subject-verb disagreement, wrong verb forms, pronoun errors
2. SPELLING MISTAKES: any misspelled words
3. WORD CHOICE ERRORS: wrong words used (like "mines" instead of "my", "cloths" instead of "clothes")
4. PUNCTUATION ERRORS: missing or incorrect punctuation, capitalization
5. STYLE IMPROVEMENTS: awkward phrasing, clarity issues

CRITICAL INSTRUCTIONS:
- Be extremely thorough like Grammarly - find EVERY single error
- Calculate EXACT character positions in the original text (count each character including spaces)
- Only suggest corrections that are definitely needed
- For each error, provide the exact text that needs to be replaced and the correct replacement
- Return ALL errors you find in one comprehensive response

Return ONLY a valid JSON array with this exact format:
[
  {
    "type": "grammar",
    "position": {"start": 13, "end": 17},
    "original": "goed", 
    "correction": "went",
    "explanation": "Past tense of 'go' is 'went', not 'goed'"
  }
]

Types to use: "grammar", "spelling", "punctuation", "style"

Count characters very carefully to get exact positions. Return empty array [] ONLY if there are truly NO errors at all.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a thorough grammar checker exactly like Grammarly. Find ALL grammatical errors, spelling mistakes, punctuation issues, and word choice problems. Be comprehensive and accurate. Return valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2000
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', response.status, response.statusText, errorText)
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid OpenAI API key. Please check your OPENAI_API_KEY in Edge Function Secrets.' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    let content = data.choices[0]?.message?.content

    console.log('Raw OpenAI response:', content)

    if (!content) {
      console.log('No content in OpenAI response')
      return new Response(
        JSON.stringify([]),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let suggestions = []
    try {
      // Clean and parse the response
      content = content.trim()
      
      // Remove markdown formatting
      content = content.replace(/```json\n?/gi, '').replace(/```\n?/gi, '')
      
      // Find the JSON array
      const jsonStart = content.indexOf('[')
      const jsonEnd = content.lastIndexOf(']')
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonContent = content.substring(jsonStart, jsonEnd + 1)
        console.log('Extracted JSON:', jsonContent)
        
        suggestions = JSON.parse(jsonContent)
        
        if (!Array.isArray(suggestions)) {
          console.log('Response is not an array:', suggestions)
          suggestions = []
        }
      } else {
        console.log('No valid JSON array found in response')
        suggestions = []
      }

      // Validate and filter suggestions
      suggestions = suggestions
        .filter(suggestion => {
          // Basic validation
          if (!suggestion.type || !suggestion.position || 
              typeof suggestion.position.start !== 'number' || 
              typeof suggestion.position.end !== 'number' ||
              !suggestion.original || !suggestion.correction || !suggestion.explanation) {
            console.log('Invalid suggestion format:', suggestion)
            return false
          }

          // Position validation
          if (suggestion.position.start < 0 || suggestion.position.end > text.length || 
              suggestion.position.start >= suggestion.position.end) {
            console.log('Invalid position:', suggestion.position)
            return false
          }

          // Verify text match (with flexibility for case and whitespace)
          const actualText = text.substring(suggestion.position.start, suggestion.position.end)
          const originalLower = suggestion.original.toLowerCase().trim()
          const actualLower = actualText.toLowerCase().trim()
          
          if (actualLower !== originalLower) {
            console.log('Position mismatch. Expected:', suggestion.original, 'Actual:', actualText)
            
            // Try to find correct position
            const searchText = text.toLowerCase()
            const searchWord = originalLower
            const index = searchText.indexOf(searchWord)
            
            if (index !== -1) {
              suggestion.position.start = index
              suggestion.position.end = index + searchWord.length
              console.log('Corrected position to:', suggestion.position)
            } else {
              console.log('Could not find text, skipping suggestion')
              return false
            }
          }

          // Don't suggest if original and correction are the same
          if (suggestion.original.toLowerCase().trim() === suggestion.correction.toLowerCase().trim()) {
            return false
          }

          return true
        })
        // Remove duplicates
        .filter((suggestion, index, array) => {
          return !array.slice(0, index).some(prev => 
            prev.position.start === suggestion.position.start &&
            prev.position.end === suggestion.position.end
          )
        })
        // Sort by position
        .sort((a, b) => a.position.start - b.position.start)

      console.log('Final validated suggestions:', suggestions.length, 'items')
      
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError)
      console.error('Content that failed to parse:', content)
      suggestions = []
    }

    return new Response(
      JSON.stringify(suggestions),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in check-text function:', error)
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
