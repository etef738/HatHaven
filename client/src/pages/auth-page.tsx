import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Shield, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertUserSchema } from "@shared/schema";
import { APP_NAME, BRAND_MESSAGING } from "@/branding/brand";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.age >= 18, {
  message: "You must be 18 or older to use this service",
  path: ["age"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("login");

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      age: 18,
    },
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      // Redirect handled by wouter below
    }
  }, [user]);

  if (user) {
    return <Redirect to="/" />;
  }

  const onLogin = (data: LoginFormData) => {
    loginMutation.mutate({
      email: data.email,
      password: data.password,
    });
  };

  const onRegister = (data: RegisterFormData) => {
    registerMutation.mutate({
      username: data.username,
      email: data.email,
      password: data.password,
      age: data.age,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-screen">
          {/* Left side - Auth forms */}
          <div className="flex items-center justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <img 
                    src="/brand/hs-logo.svg" 
                    alt={`${APP_NAME} Logo`}
                    className="w-12 h-12"
                  />
                </div>
                <CardTitle className="text-2xl font-serif bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {APP_NAME}
                </CardTitle>
                <CardDescription>
                  {BRAND_MESSAGING.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Log In</TabsTrigger>
                    <TabsTrigger value="register">Sign Up</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login">
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-email"
                                  type="email"
                                  placeholder="your.email@example.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-password"
                                  type="password"
                                  placeholder="••••••••"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Button
                          data-testid="button-login"
                          type="submit"
                          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Log In
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                  
                  <TabsContent value="register">
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-username"
                                  placeholder="your_username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-register-email"
                                  type="email"
                                  placeholder="your.email@example.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={registerForm.control}
                          name="age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Age</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-age"
                                  type="number"
                                  min="18"
                                  max="100"
                                  {...field}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    field.onChange(isNaN(value) ? 18 : value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-register-password"
                                  type="password"
                                  placeholder="••••••••"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-confirm-password"
                                  type="password"
                                  placeholder="••••••••"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="bg-muted/50 rounded-lg p-3" data-testid="info-notice">
                          <p className="text-sm text-muted-foreground">
                            <Shield className="w-4 h-4 inline mr-1" />
                            Ages 18+ only • AI disclosure • Non-therapeutic
                          </p>
                        </div>
                        
                        <Button
                          data-testid="button-register"
                          type="submit"
                          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Create Account
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right side - Hero content */}
          <div className="hidden lg:block">
            <div className="text-center space-y-8">
              <h1 className="text-5xl font-serif font-bold leading-tight">
                Your AI Companion for
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent block">
                  Connection & Growth
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-lg mx-auto">
                Practice meaningful conversations, build confidence in dating, and connect with an AI companion that remembers and grows with you.
              </p>

              <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <img 
                      src="/brand/hs-logo.svg" 
                      alt="HS Logo"
                      className="w-5 h-5 opacity-80"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">Heart Mode</h3>
                    <p className="text-sm text-muted-foreground">AI companion with memory</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Dating Training</h3>
                    <p className="text-sm text-muted-foreground">Practice scenarios with scoring</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Progress Tracking</h3>
                    <p className="text-sm text-muted-foreground">See your conversation skills improve</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
