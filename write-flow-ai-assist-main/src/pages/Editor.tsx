
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, ArrowLeft, Bold, Italic, Underline, User, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useGrammarCheck } from "@/hooks/useGrammarCheck";
import WritingStats from "@/components/WritingStats";
import SuggestionCard from "@/components/SuggestionCard";

const Editor = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const textareaRef = useRef<HTMLDivElement>(null);
  const { 
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
  } = useGrammarCheck();
  
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("Untitled Document");
  const [isSaving, setIsSaving] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [writingTime, setWritingTime] = useState(0);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [isProcessingSuggestions, setIsProcessingSuggestions] = useState(false);

  // Auto-save functionality
  const autoSave = async (contentToSave: string, titleToSave: string) => {
    if (!docId || !user || !hasUnsavedChanges) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ 
          content: contentToSave, 
          title: titleToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', docId)
        .eq('user_id', user.id);

      if (!error) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  };

  // Auto-save effect - triggers every 3 seconds when there are changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const autoSaveTimer = setTimeout(() => {
      autoSave(content, title);
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [content, title, hasUnsavedChanges, docId, user]);

  // Load document
  useEffect(() => {
    const loadDocument = async () => {
      if (!docId || !user) return;

      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', docId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error loading document:', error);
          toast({
            title: "Error",
            description: "Failed to load document",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        if (data) {
          setTitle(data.title);
          setContent(data.content || "");
          setLastSaved(new Date(data.updated_at));
          setLastAnalyzedText(data.content || "");
        }
      } catch (error) {
        console.error('Error loading document:', error);
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [docId, user, navigate, toast]);

  // Track content changes for auto-save and grammar check
  useEffect(() => {
    setHasUnsavedChanges(true);
    
    // Reset analysis state when content changes significantly
    const currentWordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    const lastWordCount = lastAnalyzedText.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // If word count changed significantly (more than 3 words), reset for new analysis
    if (Math.abs(currentWordCount - lastWordCount) > 3) {
      resetForNewText();
    }
  }, [content, title, resetForNewText, lastAnalyzedText]);

  // Grammar checking - only analyze if not completed
  useEffect(() => {
    if (content && content.trim().length > 20 && user && docId && !hasCompletedAnalysis) {
      const words = content.trim().split(/\s+/).filter(word => word.length > 0);
      if (words.length >= 5) {
        console.log('Checking text for grammar:', content.substring(0, 50) + '...');
        checkText(content, docId, user.id);
      }
    }
  }, [content, checkText, user, docId, hasCompletedAnalysis]);

  // Count words
  useEffect(() => {
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [content]);

  // Track writing time
  useEffect(() => {
    const interval = setInterval(() => {
      setWritingTime(prev => prev + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user && !isLoading) {
      navigate("/");
    }
  }, [user, navigate, isLoading]);

  const handleSave = async () => {
    if (!docId || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ 
          content, 
          title,
          updated_at: new Date().toISOString()
        })
        .eq('id', docId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving document:', error);
        toast({
          title: "Error",
          description: "Failed to save document",
          variant: "destructive",
        });
      } else {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        toast({
          title: "Document saved",
          description: "Your changes have been saved successfully",
        });
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: "Error",
        description: "Failed to save document",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    navigate("/dashboard");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const applyFormatting = (format: string) => {
    const div = textareaRef.current;
    if (!div) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // No selection, just toggle the state for future typing
      switch (format) {
        case "bold":
          setIsBold(!isBold);
          break;
        case "italic":
          setIsItalic(!isItalic);
          break;
        case "underline":
          setIsUnderline(!isUnderline);
          break;
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (selectedText) {
      // Apply document.execCommand for rich text formatting
      document.execCommand('styleWithCSS', false, 'true');
      
      switch (format) {
        case "bold":
          document.execCommand('bold', false, '');
          setIsBold(!isBold);
          break;
        case "italic":
          document.execCommand('italic', false, '');
          setIsItalic(!isItalic);
          break;
        case "underline":
          document.execCommand('underline', false, '');
          setIsUnderline(!isUnderline);
          break;
        default:
          return;
      }
      
      // Update content from the div
      setContent(div.textContent || "");
      
      // Focus back to div
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // Improved word boundary detection
  const findWordBoundaries = (text: string, word: string, startSearchPos: number = 0) => {
    const searchText = text.toLowerCase();
    const searchWord = word.toLowerCase().trim();
    
    // Find all occurrences of the word with word boundaries
    const regex = new RegExp(`\\b${searchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });
    }
    
    return matches;
  };

  const setCursorPosition = (element: HTMLDivElement, position: number) => {
    const range = document.createRange();
    const selection = window.getSelection();
    
    if (!selection) return;
    
    // Find the text node and position within it
    let currentPos = 0;
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      const nodeLength = node.textContent?.length || 0;
      if (currentPos + nodeLength >= position) {
        const offsetInNode = position - currentPos;
        range.setStart(node, Math.min(offsetInNode, nodeLength));
        range.setEnd(node, Math.min(offsetInNode, nodeLength));
        break;
      }
      currentPos += nodeLength;
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleAcceptSuggestion = (suggestion: any) => {
    console.log('Accepting suggestion:', suggestion);
    
    setIsProcessingSuggestions(true);
    startProcessingSuggestions();
    
    // Validate position bounds
    if (suggestion.position.start < 0 || 
        suggestion.position.end > content.length || 
        suggestion.position.start >= suggestion.position.end) {
      console.error('Invalid suggestion position:', suggestion.position);
      toast({
        title: "Error",
        description: "Cannot apply suggestion - invalid position",
        variant: "destructive",
      });
      finishProcessingSuggestions();
      return;
    }

    // Extract the text that should be at the position
    const actualText = content.substring(suggestion.position.start, suggestion.position.end);
    console.log('Position check - Expected:', suggestion.original, 'Actual:', actualText);
    
    let correctedPosition = { ...suggestion.position };
    let foundMatch = false;

    // First try exact match
    if (actualText === suggestion.original) {
      foundMatch = true;
    } 
    // Then try case-insensitive match
    else if (actualText.toLowerCase().trim() === suggestion.original.toLowerCase().trim()) {
      foundMatch = true;
    }
    // If no match, use word boundary detection to find the correct position
    else {
      console.warn('Position mismatch, searching for correct word boundary...');
      
      // Find all word boundaries for this word
      const wordMatches = findWordBoundaries(content, suggestion.original);
      
      if (wordMatches.length > 0) {
        // Find the closest match to the suggested position
        let closestMatch = wordMatches[0];
        let minDistance = Math.abs(wordMatches[0].start - suggestion.position.start);
        
        for (const match of wordMatches) {
          const distance = Math.abs(match.start - suggestion.position.start);
          if (distance < minDistance) {
            minDistance = distance;
            closestMatch = match;
          }
        }
        
        // Use the closest match
        correctedPosition.start = closestMatch.start;
        correctedPosition.end = closestMatch.end;
        foundMatch = true;
        console.log('Found word boundary match:', correctedPosition);
      }
    }

    if (!foundMatch) {
      console.error('Could not find matching text for suggestion');
      toast({
        title: "Error",
        description: "Cannot apply suggestion - text has changed. Please refresh suggestions.",
        variant: "destructive",
      });
      
      finishProcessingSuggestions();
      return;
    }

    // Apply the correction using the corrected position
    const beforeText = content.substring(0, correctedPosition.start);
    const afterText = content.substring(correctedPosition.end);
    const newContent = beforeText + suggestion.correction + afterText;
    
    console.log('Applying correction:', {
      before: content.substring(correctedPosition.start, correctedPosition.end),
      after: suggestion.correction,
      position: correctedPosition
    });
    
    // Update content
    setContent(newContent);
    
    // Remove this specific suggestion
    removeSuggestion(suggestion.id);
    
    // Update cursor position to be after the correction
    if (textareaRef.current) {
      const newPosition = correctedPosition.start + suggestion.correction.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          setCursorPosition(textareaRef.current, newPosition);
        }
      }, 0);
    }

    toast({
      title: "Suggestion applied",
      description: `Changed "${suggestion.original}" to "${suggestion.correction}"`,
    });

    setTimeout(() => {
      setIsProcessingSuggestions(false);
      finishProcessingSuggestions();
    }, 500);
  };

  const handleRejectSuggestion = (suggestion: any) => {
    removeSuggestion(suggestion.id);
    
    toast({
      title: "Suggestion rejected",
      description: "The suggestion has been dismissed",
    });
  };

  const handleAcceptAllSuggestions = () => {
    if (suggestions.length === 0) return;

    setIsProcessingSuggestions(true);
    startProcessingSuggestions();
    
    // Sort suggestions by position (start from the end to avoid position shifts)
    const sortedSuggestions = [...suggestions].sort((a, b) => b.position.start - a.position.start);
    
    let newContent = content;
    let appliedCount = 0;
    
    sortedSuggestions.forEach((suggestion) => {
      // Use word boundary detection for each suggestion
      const wordMatches = findWordBoundaries(newContent, suggestion.original);
      
      if (wordMatches.length > 0) {
        // Find the match closest to the suggested position
        let closestMatch = wordMatches[0];
        let minDistance = Math.abs(wordMatches[0].start - suggestion.position.start);
        
        for (const match of wordMatches) {
          const distance = Math.abs(match.start - suggestion.position.start);
          if (distance < minDistance) {
            minDistance = distance;
            closestMatch = match;
          }
        }
        
        // Apply the correction
        const beforeText = newContent.substring(0, closestMatch.start);
        const afterText = newContent.substring(closestMatch.end);
        newContent = beforeText + suggestion.correction + afterText;
        appliedCount++;
      }
    });
    
    if (appliedCount > 0) {
      setContent(newContent);
      clearSuggestions();
      
      toast({
        title: "All suggestions applied",
        description: `Applied ${appliedCount} suggestions successfully`,
      });
    } else {
      toast({
        title: "No suggestions applied",
        description: "Text may have changed. Please refresh suggestions.",
        variant: "destructive",
      });
    }
    
    setTimeout(() => {
      setIsProcessingSuggestions(false);
      finishProcessingSuggestions();
    }, 500);
  };

  const formatLastSaved = () => {
    if (!lastSaved) return "Never saved";
    const now = new Date();
    const diffMs = now.getTime() - lastSaved.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just saved";
    if (diffMins === 1) return "1 minute ago";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    return `${diffHours} hours ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading document...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-inter">
      {/* Grammarly-style Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={handleBack}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-500">
                {hasUnsavedChanges ? "Saving..." : formatLastSaved()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Enhanced Formatting Toolbar */}
            <div className="flex items-center gap-1 mr-4 p-1 bg-gray-50 rounded-lg border">
              <Toggle
                pressed={isBold}
                onPressedChange={() => applyFormatting("bold")}
                size="sm"
                className="h-8 w-8 p-0 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
              >
                <Bold className="w-4 h-4" />
              </Toggle>
              <Toggle
                pressed={isItalic}
                onPressedChange={() => applyFormatting("italic")}
                size="sm"
                className="h-8 w-8 p-0 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
              >
                <Italic className="w-4 h-4" />
              </Toggle>
              <Toggle
                pressed={isUnderline}
                onPressedChange={() => applyFormatting("underline")}
                size="sm"
                className="h-8 w-8 p-0 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
              >
                <Underline className="w-4 h-4" />
              </Toggle>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-3 ml-4">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Editor Layout - Grammarly Style */}
      <div className="flex-1 flex bg-gray-50">
        {/* Writing Area */}
        <div className="flex-1 flex justify-center py-8">
          <div className="w-full max-w-4xl bg-white rounded-lg shadow-sm border border-gray-200 mx-6">
            <div className="p-8">
              <div
                ref={textareaRef}
                contentEditable
                suppressContentEditableWarning={true}
                onInput={(e) => setContent(e.currentTarget.textContent || "")}
                className="w-full h-[calc(100vh-280px)] resize-none border-0 outline-none text-gray-900 text-lg leading-relaxed focus:outline-none"
                style={{ 
                  fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                  lineHeight: '1.8'
                }}
                data-placeholder="Start writing, or paste your document here to check for grammar, spelling, and style suggestions."
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          </div>
        </div>

        {/* Grammarly-style Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Writing Assistant</h2>
              {isChecking && (
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            
            {/* Goals Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Goals</h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Correctness</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Clarity</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">Engagement</span>
              </div>
            </div>
          </div>

          {/* Suggestions with Accept All button */}
          <div className="flex-1 overflow-y-auto p-6">
            {suggestions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">
                    {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                  </h3>
                  <Button
                    onClick={handleAcceptAllSuggestions}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3"
                    disabled={isProcessingSuggestions}
                  >
                    Accept All
                  </Button>
                </div>
                {/* Sort suggestions by priority: grammar > spelling > punctuation > style */}
                {[...suggestions]
                  .sort((a, b) => {
                    const priority = { grammar: 0, spelling: 1, punctuation: 2, style: 3 };
                    return priority[a.type] - priority[b.type];
                  })
                  .map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onAccept={handleAcceptSuggestion}
                      onReject={handleRejectSuggestion}
                    />
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                {isChecking ? (
                  <div>
                    <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-600">Analyzing your text...</p>
                  </div>
                ) : hasCompletedAnalysis ? (
                  <div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <div className="w-6 h-6 bg-green-600 rounded-full"></div>
                    </div>
                    <p className="text-gray-600 font-medium">Great writing!</p>
                    <p className="text-gray-500 text-sm mt-1">No writing issues found</p>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <div className="w-6 h-6 bg-gray-400 rounded-full"></div>
                    </div>
                    <p className="text-gray-600">Start writing to get suggestions</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Performance Stats */}
          <div className="border-t border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Overall score</span>
                <span className="font-medium text-green-600">
                  {suggestions.length === 0 ? '95' : Math.max(70, 95 - suggestions.length * 5)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Correctness</span>
                <span className="font-medium">
                  {suggestions.filter(s => s.type === 'grammar' || s.type === 'spelling').length === 0 ? '95' : '85'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Clarity</span>
                <span className="font-medium">
                  {suggestions.filter(s => s.type === 'style').length === 0 ? '90' : '80'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Engagement</span>
                <span className="font-medium">87</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grammarly-style Status Bar */}
      <div className="bg-gray-900 text-white px-6 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <span>{wordCount} words</span>
            <span>{content.length} characters</span>
            <span>{content.split('\n\n').filter(p => p.trim()).length} paragraphs</span>
            <span>{Math.ceil(wordCount / 200)} min read</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Writing time: {writingTime} min</span>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white border-0 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : hasUnsavedChanges ? "Save" : "Saved"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
