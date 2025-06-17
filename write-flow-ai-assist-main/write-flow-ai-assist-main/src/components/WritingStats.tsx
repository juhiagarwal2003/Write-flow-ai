
import { useMemo } from "react";

interface WritingStatsProps {
  wordCount: number;
  writingTime: number;
  content: string;
}

const WritingStats = ({ wordCount, writingTime, content }: WritingStatsProps) => {
  const readabilityScore = useMemo(() => {
    // Simple Flesch-Kincaid approximation
    if (!content || wordCount === 0) return 0;
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const syllables = content.split('').filter(char => 'aeiouAEIOU'.includes(char)).length;
    
    if (sentences === 0) return 0;
    
    const avgWordsPerSentence = wordCount / sentences;
    const avgSyllablesPerWord = syllables / wordCount;
    
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }, [content, wordCount]);

  const getReadabilityLabel = (score: number) => {
    if (score >= 90) return "Very Easy";
    if (score >= 80) return "Easy";
    if (score >= 70) return "Fairly Easy";
    if (score >= 60) return "Standard";
    if (score >= 50) return "Fairly Difficult";
    if (score >= 30) return "Difficult";
    return "Very Difficult";
  };

  return (
    <div className="stats-bar text-white px-6 py-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Words:</span>
            <span className="font-medium">{wordCount}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Readability:</span>
            <span className="font-medium">{readabilityScore} ({getReadabilityLabel(readabilityScore)})</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Writing time:</span>
            <span className="font-medium">{writingTime} min</span>
          </div>
        </div>
        
        <div className="text-gray-400 text-xs">
          Connect to Supabase for real-time grammar checking
        </div>
      </div>
    </div>
  );
};

export default WritingStats;
