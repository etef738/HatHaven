import { Heart, Users, Sparkles, Coffee, Utensils, TreePine, Shield, Lock, UserCheck, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import Navbar from "@/components/navbar";
import { APP_NAME, BRAND_MESSAGING } from "@/branding/brand";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function HomePage() {
  const { user } = useAuth();
  useDocumentTitle(); // Set page title to HeartScene

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center">
          {/* AI Disclosure Banner */}
          <div className="bg-muted border border-border rounded-lg p-3 mb-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>{BRAND_MESSAGING.description} • Ages 18+ only</span>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6 leading-tight">
              Your AI Companion for
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent block">
                Connection & Growth
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Practice meaningful conversations, build confidence in dating, and connect with an AI companion that remembers and grows with you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button
                data-testid="button-start-heart-mode"
                asChild
                className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-4 text-lg hover:opacity-90"
                size="lg"
              >
                <Link href="/chat">
                  <Heart className="w-5 h-5 mr-2" />
                  Start Heart Mode
                </Link>
              </Button>
              <Button
                data-testid="button-try-dating-training"
                asChild
                variant="outline"
                className="px-8 py-4 text-lg border-border hover:bg-muted"
                size="lg"
              >
                <Link href="/scenarios">
                  <Users className="w-5 h-5 mr-2" />
                  Try Dating Training
                </Link>
              </Button>
            </div>

            {/* Hero Visual */}
            <div className="relative max-w-3xl mx-auto">
              <img 
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=600" 
                alt={`${APP_NAME} app interface showing AI companion chat`} 
                className="rounded-2xl shadow-2xl w-full"
              />
              
              {/* Floating Chat Bubbles */}
              <div className="absolute -top-4 -left-4 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-pulse">
                <span className="text-sm">Tell me about your day! ✨</span>
              </div>
              <div className="absolute -bottom-4 -right-4 bg-secondary text-foreground px-4 py-2 rounded-full shadow-lg animate-pulse" style={{animationDelay: '1.5s'}}>
                <span className="text-sm">Great conversation skills! ⭐</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two Modes Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-serif font-bold mb-4">Two Modes, Endless Growth</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Whether you're seeking companionship or wanting to improve your dating skills, we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Heart Mode */}
            <Card className="bg-card border border-border shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center mb-6">
                  <Heart className="text-white text-2xl" />
                </div>
                
                <h3 className="text-2xl font-serif font-semibold mb-4">Heart Mode</h3>
                <p className="text-muted-foreground mb-6">
                  Connect with your AI companion who remembers your conversations, understands your personality, and provides emotional support whenever you need it.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Long-term memory of conversations</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Personalized AI companion</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>24/7 emotional support</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Voice & text chat options</span>
                  </div>
                </div>

                <Button data-testid="button-heart-mode-cta" asChild className="w-full bg-primary text-primary-foreground hover:opacity-90">
                  <Link href="/chat">Start Chatting</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Dating Training Mode */}
            <Card className="bg-card border border-border shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-6">
                  <Users className="text-white text-2xl" />
                </div>
                
                <h3 className="text-2xl font-serif font-semibold mb-4">Dating Training</h3>
                <p className="text-muted-foreground mb-6">
                  Practice real dating scenarios in a safe environment. Get detailed feedback on your conversation skills and build confidence for real-world interactions.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    <span>3 realistic practice scenarios</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    <span>Performance scoring & feedback</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    <span>Track your improvement over time</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    <span>Expert dating coach insights</span>
                  </div>
                </div>

                <Button data-testid="button-dating-training-cta" asChild className="w-full bg-secondary text-foreground hover:opacity-90">
                  <Link href="/scenarios">Start Training</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Scenarios Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-serif font-bold mb-4">Practice Real Scenarios</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Build confidence through realistic dating scenarios designed by relationship experts.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Coffee Shop Scenario */}
            <Card className="bg-card border border-border shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <img 
                  src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250" 
                  alt="Cozy coffee shop interior for first meeting scenario" 
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                
                <h3 className="text-xl font-semibold mb-2">Coffee Shop Meet</h3>
                <p className="text-muted-foreground mb-4">
                  Practice first impressions and casual conversation in a relaxed coffee shop setting.
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Difficulty:</span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="w-2 h-2 bg-muted rounded-full"></div>
                      <div className="w-2 h-2 bg-muted rounded-full"></div>
                    </div>
                  </div>
                  <span className="text-sm text-secondary font-medium">~10 mins</span>
                </div>
              </CardContent>
            </Card>

            {/* Restaurant Scenario */}
            <Card className="bg-card border border-border shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <img 
                  src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250" 
                  alt="Elegant restaurant dining setting for dinner date scenario" 
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                
                <h3 className="text-xl font-semibold mb-2">Dinner Date</h3>
                <p className="text-muted-foreground mb-4">
                  Navigate deeper conversations and handle potential awkward moments during dinner.
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Difficulty:</span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="w-2 h-2 bg-muted rounded-full"></div>
                    </div>
                  </div>
                  <span className="text-sm text-secondary font-medium">~15 mins</span>
                </div>
              </CardContent>
            </Card>

            {/* First Date Scenario */}
            <Card className="bg-card border border-border shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <img 
                  src="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250" 
                  alt="Romantic park setting for first date walking scenario" 
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                
                <h3 className="text-xl font-semibold mb-2">First Date Walk</h3>
                <p className="text-muted-foreground mb-4">
                  Master the art of getting to know someone while handling nerves and building chemistry.
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Difficulty:</span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                  </div>
                  <span className="text-sm text-secondary font-medium">~20 mins</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <Button data-testid="button-try-first-scenario" asChild className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 hover:opacity-90">
              <Link href="/scenarios">
                Try Your First Scenario
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-serif font-bold mb-4">Your Safety Comes First</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We've built comprehensive safety measures to ensure a positive and secure experience for everyone.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {/* Age Verification */}
            <Card className="bg-card border border-border text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="text-primary text-xl" />
                </div>
                <h3 className="font-semibold mb-2">Age Verification</h3>
                <p className="text-sm text-muted-foreground">Strict 18+ verification for all users</p>
              </CardContent>
            </Card>

            {/* Content Filtering */}
            <Card className="bg-card border border-border text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="text-secondary text-xl" />
                </div>
                <h3 className="font-semibold mb-2">Content Filtering</h3>
                <p className="text-sm text-muted-foreground">Advanced AI safety filters protect conversations</p>
              </CardContent>
            </Card>

            {/* Privacy Protection */}
            <Card className="bg-card border border-border text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Lock className="text-primary text-xl" />
                </div>
                <h3 className="font-semibold mb-2">Privacy Protected</h3>
                <p className="text-sm text-muted-foreground">Your conversations stay private and secure</p>
              </CardContent>
            </Card>

            {/* Professional Support */}
            <Card className="bg-card border border-border text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="text-secondary text-xl" />
                </div>
                <h3 className="font-semibold mb-2">Non-Therapeutic</h3>
                <p className="text-sm text-muted-foreground">Clear boundaries - not a replacement for therapy</p>
              </CardContent>
            </Card>
          </div>

          {/* Safety Disclaimer */}
          <Card className="max-w-4xl mx-auto mt-12 bg-muted border border-border">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <Shield className="text-muted-foreground mt-1 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Important Disclaimer:</p>
                  <p>{BRAND_MESSAGING.disclaimer}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted py-12 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                  <Heart className="text-white text-sm" />
                </div>
                <span className="text-lg font-serif font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{APP_NAME}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered connections for personal growth and dating confidence.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/chat" className="hover:text-foreground transition-colors">Heart Mode</Link></li>
                <li><Link href="/scenarios" className="hover:text-foreground transition-colors">Dating Training</Link></li>
                <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Progress Tracking</Link></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Safety Features</span></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Help Center</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Contact Us</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Community Guidelines</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Report an Issue</span></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Terms of Service</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Cookie Policy</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer">Age Verification</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="text-sm text-muted-foreground">
                © 2024 {APP_NAME}. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
