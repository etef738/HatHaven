import { Menu, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { APP_NAME } from "@/branding/brand";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const navigationItems = [
    { href: "/", label: "Home" },
    { href: "/chat", label: "Heart Mode" },
    { href: "/scenarios", label: "Dating Training" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3" data-testid="link-brand-logo">
            <img 
              src="/brand/hs-logo.svg" 
              alt={`${APP_NAME} Logo`}
              className="w-8 h-8"
            />
            <span className="text-xl font-serif font-semibold gradient-text">
              {APP_NAME}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors ${
                  location === item.href
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                {/* Desktop User Menu */}
                <div className="hidden md:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center space-x-2"
                        data-testid="button-user-menu"
                      >
                        <User className="w-4 h-4" />
                        <span>{user.username}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center">
                          <User className="w-4 h-4 mr-2" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="flex items-center text-destructive focus:text-destructive"
                        data-testid="button-logout"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile Menu */}
                <div className="md:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                        <Menu className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <div className="flex flex-col space-y-4 mt-8">
                        <div className="flex items-center space-x-2 pb-4 border-b border-border">
                          <User className="w-4 h-4" />
                          <span className="font-medium">{user.username}</span>
                        </div>
                        
                        {navigationItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`block py-2 transition-colors ${
                              location === item.href
                                ? "text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                        
                        <Button
                          variant="destructive"
                          onClick={handleLogout}
                          className="justify-start mt-4"
                          data-testid="button-mobile-logout"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Logout
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Button variant="ghost" asChild data-testid="button-nav-login">
                  <Link href="/auth">Log In</Link>
                </Button>
                <Button
                  asChild
                  className="bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90"
                  data-testid="button-nav-signup"
                >
                  <Link href="/auth">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
