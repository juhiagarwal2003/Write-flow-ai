
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X } from "lucide-react";

interface Suggestion {
  id: string;
  type: "grammar" | "spelling" | "style" | "punctuation";
  position: { start: number; end: number };
  original: string;
  correction: string;
  explanation: string;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (suggestion: Suggestion) => void;
  onReject: (suggestion: Suggestion) => void;
}

const SuggestionCard = ({ suggestion, onAccept, onReject }: SuggestionCardProps) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "grammar":
        return "bg-red-50 text-red-700 border-red-200";
      case "spelling":
        return "bg-red-50 text-red-700 border-red-200";
      case "style":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "punctuation":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "grammar":
        return "🔤";
      case "spelling":
        return "📝";
      case "style":
        return "✨";
      case "punctuation":
        return "⚪";
      default:
        return "💡";
    }
  };

  return (
    <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">{getTypeIcon(suggestion.type)}</span>
            <Badge variant="outline" className={`text-xs ${getTypeColor(suggestion.type)}`}>
              {suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)}
            </Badge>
          </div>
        </div>
        
        <div className="space-y-3 mb-4">
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <span className="text-sm text-red-800 line-through">
              {suggestion.original}
            </span>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-2">
            <span className="text-sm text-green-800 font-medium">
              {suggestion.correction}
            </span>
          </div>
        </div>
        
        <p className="text-sm text-gray-700 mb-4 leading-relaxed">
          {suggestion.explanation}
        </p>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onAccept(suggestion)}
            className="bg-green-600 hover:bg-green-700 text-white flex-1 text-xs h-8"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(suggestion)}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 flex-1 text-xs h-8"
          >
            <X className="w-3 h-3 mr-1" />
            Ignore
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SuggestionCard;
