
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Clock, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Document {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, loading } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
      return;
    }

    if (user) {
      fetchDocuments();
      
      // Set up realtime subscription
      const channel = supabase
        .channel('documents_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'documents'
          },
          () => {
            fetchDocuments();
          }
        )
        .subscribe();

      // Cleanup function
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, loading, navigate]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert([
          {
            title: 'Untitled Document',
            content: '',
            user_id: user?.id
          }
        ])
        .select()
        .single();

      if (error) throw error;
      
      navigate(`/editor/${data.id}`);
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: "Error",
        description: "Failed to create new document",
        variant: "destructive",
      });
    }
  };

  const handleOpenDocument = (docId: string) => {
    navigate(`/editor/${docId}`);
  };

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
    navigate("/");
  };

  const getWordCount = (content: string) => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">WriteAssist</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleNewDocument}
                className="bg-accent hover:bg-accent/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Document
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <Button variant="ghost" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Documents</h2>
          <p className="text-gray-600">Manage and organize your writing projects</p>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading documents...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <Card 
                key={doc.id} 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:transform hover:scale-105"
                onClick={() => handleOpenDocument(doc.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <FileText className="w-8 h-8 text-primary mb-2" />
                    <span className="text-xs text-gray-500 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{doc.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4 line-clamp-2">
                    {doc.content || "No content yet..."}
                  </CardDescription>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>{getWordCount(doc.content)} words</span>
                    <Button variant="ghost" size="sm">
                      Open
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* New Document Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:transform hover:scale-105 border-dashed border-2 border-gray-300 bg-gray-50"
              onClick={handleNewDocument}
            >
              <CardContent className="flex flex-col items-center justify-center h-48 text-gray-500">
                <Plus className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium">Create New Document</p>
                <p className="text-sm text-center mt-2">Start writing with AI-powered assistance</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-accent mr-3" />
                <div>
                  <p className="text-2xl font-bold">{documents.length}</p>
                  <p className="text-gray-600">Documents</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">W</span>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {documents.reduce((sum, doc) => sum + getWordCount(doc.content), 0)}
                  </p>
                  <p className="text-gray-600">Total Words</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-accent mr-3" />
                <div>
                  <p className="text-2xl font-bold">24h</p>
                  <p className="text-gray-600">Writing Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
