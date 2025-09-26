import { useState } from "react";
import { Heart, Sparkles, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/navbar";
import ChatBox from "@/components/chat-box";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function ChatPage() {
  const { user } = useAuth();
  const [hasStartedChat, setHasStartedChat] = useState(false);
  useDocumentTitle("Heart Mode");

  const handleMessageSent = () => {
    if (!hasStartedChat) {
      setHasStartedChat(true);
    }
  };

  if (hasStartedChat) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 container mx-auto px-6 py-8">
          <div className="max-w-4xl mx-auto h-full">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-serif font-bold">Heart Mode</h1>
                  <p className="text-muted-foreground">Your AI companion with memory</p>
                </div>
              </div>
            </div>
            
            <div className="h-[calc(100vh-200px)]">
              <ChatBox 
                mode="heart" 
                onMessageSent={handleMessageSent}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Navbar />
      
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-serif font-bold mb-4">
              Welcome to Heart Mode, {user?.username}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your AI companion is here to listen, understand, and grow with you. 
              Start a conversation about anything on your mind.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Natural Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Chat naturally about your thoughts, feelings, and experiences. 
                  Your companion responds with empathy and understanding.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-secondary" />
                </div>
                <CardTitle className="text-lg">Memory & Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your AI companion remembers your conversations and builds 
                  a deeper understanding of your personality over time.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Emotional Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get emotional support and encouragement whenever you need it. 
                  Your companion is always here to listen.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Card className="max-w-2xl mx-auto">
              <CardContent className="p-8">
                <h3 className="text-2xl font-serif font-semibold mb-4">
                  Ready to Start Chatting?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Your AI companion is waiting to meet you. Share what's on your mind, 
                  ask questions, or just say hello. There's no wrong way to begin.
                </p>
                <div className="h-96">
                  <ChatBox 
                    mode="heart" 
                    onMessageSent={handleMessageSent}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Disclaimer */}
          <Card className="mt-8 bg-muted/50 border-muted">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Heart className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Remember:</p>
                  <p>
                    Your AI companion is here for emotional support and meaningful conversation, 
                    but is not a replacement for professional mental health services. 
                    If you're experiencing serious mental health concerns, please reach out to a qualified professional.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
