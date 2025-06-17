
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debounce } from 'lodash';
import { useToast } from '@/hooks/use-toast';

export interface Suggestion {
  id: string;
  type: "grammar" | "spelling" | "style" | "punctuation";
  position: { start: number; end: number };
  original: string;
  correction: string;
  explanation: string;
}

export const useGrammarCheck = () => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastAnalyzedText, setLastAnalyzedText] = useState<string>("");
  const [isProcessingSuggestions, setIsProcessingSuggestions] = useState(false);
  const [hasCompletedAnalysis, setHasCompletedAnalysis] = useState(false);
  const { toast } = useToast();

  const checkText = useCallback(
    debounce(async (text: string, documentId?: string, userId?: string) => {
      // Don't re-analyze if we're processing suggestions or have completed analysis for this exact text
      if (isProcessingSuggestions) {
        return;
      }

      // If text is the same as last analyzed and we've completed analysis, don't re-analyze
      if (text === lastAnalyzedText && hasCompletedAnalysis) {
        return;
      }

      if (!text || text.trim().length < 10) {
        setSuggestions([]);
        setLastAnalyzedText("");
        setHasCompletedAnalysis(false);
        return;
      }

      // Avoid over-analyzing by checking content quality
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      if (words.length < 3) {
        setSuggestions([]);
        setLastAnalyzedText("");
        setHasCompletedAnalysis(false);
        return;
      }

      console.log('Starting grammar check for text:', text.substring(0, 50) + '...');
      setIsChecking(true);
      setHasCompletedAnalysis(false);
      
      try {
        const { data, error } = await supabase.functions.invoke('check-text', {
          body: { 
            text,
            documentId: documentId || null,
            userId: userId || null
          }
        });

        console.log('Grammar check response:', { data, error });

        if (error) {
          console.error('Grammar check error:', error);
          
          // Show user-friendly error messages
          if (error.message?.includes('OpenAI API key')) {
            toast({
              title: "Configuration Error",
              description: "OpenAI API key is not configured. Please contact support.",
              variant: "destructive",
            });
          } else if (error.message?.includes('Invalid OpenAI API key')) {
            toast({
              title: "Configuration Error", 
              description: "Invalid OpenAI API key. Please contact support.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Grammar Check Error",
              description: "Unable to check grammar. Please try again.",
              variant: "destructive",
            });
          }
          
          setSuggestions([]);
          return;
        }

        // Ensure data is an array
        const suggestionsArray = Array.isArray(data) ? data : [];
        console.log('Raw suggestions from API:', suggestionsArray);

        // Process and add IDs to suggestions
        const suggestionsWithIds = suggestionsArray
          .filter((suggestion: any) => {
            return suggestion && 
                   suggestion.position && 
                   typeof suggestion.position.start === 'number' && 
                   typeof suggestion.position.end === 'number' &&
                   suggestion.position.start >= 0 &&
                   suggestion.position.end <= text.length &&
                   suggestion.position.start < suggestion.position.end &&
                   suggestion.original && 
                   suggestion.correction && 
                   suggestion.explanation &&
                   suggestion.original !== suggestion.correction;
          })
          .map((suggestion: any, index: number) => ({
            ...suggestion,
            id: `suggestion-${Date.now()}-${index}`,
            position: {
              start: Math.max(0, Math.min(suggestion.position.start, text.length)),
              end: Math.max(0, Math.min(suggestion.position.end, text.length))
            }
          }))
          // Remove duplicates
          .filter((suggestion: any, index: number, array: any[]) => {
            return !array.slice(0, index).some((prevSuggestion: any) => 
              prevSuggestion.position.start === suggestion.position.start &&
              prevSuggestion.position.end === suggestion.position.end &&
              prevSuggestion.original === suggestion.original
            );
          })
          // Sort by position
          .sort((a: any, b: any) => a.position.start - b.position.start);

        console.log('Processed and filtered suggestions:', suggestionsWithIds);
        
        // Set suggestions and remember this text
        setSuggestions(suggestionsWithIds);
        setLastAnalyzedText(text);
        setHasCompletedAnalysis(true);
        
      } catch (error) {
        console.error('Error checking text:', error);
        toast({
          title: "Error",
          description: "Failed to check grammar. Please try again.",
          variant: "destructive",
        });
        setSuggestions([]);
      } finally {
        setIsChecking(false);
      }
    }, 1500),
    [lastAnalyzedText, isProcessingSuggestions, hasCompletedAnalysis, toast]
  );

  const removeSuggestion = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setLastAnalyzedText("");
    setHasCompletedAnalysis(false);
  }, []);

  const startProcessingSuggestions = useCallback(() => {
    setIsProcessingSuggestions(true);
  }, []);

  const finishProcessingSuggestions = useCallback(() => {
    setIsProcessingSuggestions(false);
  }, []);

  const resetForNewText = useCallback(() => {
    setLastAnalyzedText("");
    setIsProcessingSuggestions(false);
    setHasCompletedAnalysis(false);
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isChecking,
    checkText,
    setSuggestions,
    removeSuggestion,
    clearSuggestions,
    startProcessingSuggestions,
    finishProcessingSuggestions,
    resetForNewText,
    hasCompletedAnalysis
  };
};
