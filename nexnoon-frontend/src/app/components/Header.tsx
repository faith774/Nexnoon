import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/app/components/ui/sheet';
import { useBackendData } from '@/hooks/useBackendData';
import { Search, Menu, User, LogOut, Bell, HelpCircle, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  variant?: "default" | "light";
}

export default function Header({ variant = "light" }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const unread = useBackendData<{ pagination: { totalItems: number } }>('/notifications?unread=true&pageSize=1');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const forceLight = variant === "light";
  const showWhiteBg = forceLight || isScrolled;

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      showWhiteBg ? "bg-white border-b border-black/10 shadow-sm" : "bg-black/5 backdrop-blur-sm"
    }`}>
      <div className="w-[90vw] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-8">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 -ml-8">
            <Link to="/" className="group flex items-center">
              <div className="relative">
                <span className="text-2xl font-bold tracking-tight flex items-center">
                  <span className={showWhiteBg ? "text-black" : "text-white"}>Nexnoon</span>
                </span>
                <div className={`absolute -bottom-0.5 right-0 w-4 h-0.5 ${showWhiteBg ? "bg-black" : "bg-white"} group-hover:w-full transition-all duration-300`}></div>
              </div>
            </Link>
          </div>

          {/* Search Bar */}
          {showWhiteBg && (
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <form className="relative w-full" onSubmit={e => { e.preventDefault(); if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); }}>
                <Input
                  type="text"
                  placeholder="What do you want to learn?"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Search classes"
                  className="w-full pl-4 pr-11 py-3.5 text-sm rounded-full border border-gray-200 focus-visible:border-black focus-visible:ring-0 focus-visible:outline-none transition-colors bg-white text-black h-auto cursor-pointer"
                />
                <button type="submit" aria-label="Search" className="absolute right-4 top-1/2 -translate-y-1/2"><Search className="h-4 w-4 text-black" /></button>
              </form>
            </div>
          )}

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/browse" className={`${showWhiteBg ? "text-black/70 hover:text-black" : "text-white/70 hover:text-white"} transition-colors text-sm font-medium`}>
              Browse
            </Link>
            <Link to="/categories" className={`${showWhiteBg ? "text-black/70 hover:text-black" : "text-white/70 hover:text-white"} transition-colors text-sm font-medium`}>
              Categories
            </Link>
            <Link to="/teach" className={`${showWhiteBg ? "text-black/70 hover:text-black" : "text-white/70 hover:text-white"} transition-colors text-sm font-medium`}>
              Teach
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-4 flex-shrink-0 -mr-8">
            {isAuthenticated ? (
              <>
                {/* Help Icon */}
                <Link to="/help">
                  <Button variant="ghost" size="icon" className={`hidden sm:flex ${showWhiteBg ? "text-gray-600 hover:bg-gray-100" : "text-white hover:bg-white/10"}`}>
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </Link>

                {/* Notifications Icon */}
                <Link to="/notifications">
                  <Button variant="ghost" size="icon" className={`hidden sm:flex ${showWhiteBg ? "text-gray-600 hover:bg-gray-100" : "text-white hover:bg-white/10"} relative`}>
                    <Bell className="h-5 w-5" />
                    {(unread.data?.pagination.totalItems || 0) > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" aria-label="Unread notifications" />}
                  </Button>
                </Link>

                <Link to="/my-classes">
                  <Button variant="ghost" className={`hidden sm:flex ${showWhiteBg ? "text-black hover:bg-black/5" : "text-white hover:bg-white/10"}`}>
                    My Classes
                  </Button>
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-[#889dd1] to-gray-400 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2">
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                      <Link
                        to="/my-classes"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Search className="h-4 w-4" />
                        My Classes
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <SettingsIcon className="h-4 w-4" />
                        Settings
                      </Link>
                      <hr className="my-2 border-gray-200" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" className="hidden sm:flex border-black text-black hover:bg-black hover:text-white">
                    Log In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className={showWhiteBg ? "bg-black text-white hover:bg-black/90" : "bg-white text-black hover:bg-white/90"}>
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
            
            <Sheet open={mobileOpen} onOpenChange={open => { setMobileOpen(open); if (open) setShowUserMenu(false); }}>
              <SheetTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Open navigation menu" className={`md:hidden ${showWhiteBg ? "hover:bg-black/5" : "hover:bg-white/10"}`}>
                  <Menu className={`h-5 w-5 ${showWhiteBg ? "text-black" : "text-white"}`} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(90vw,360px)] overflow-y-auto bg-white text-black">
                <SheetHeader className="border-b p-6">
                  <SheetTitle className="text-2xl font-bold">Nexnoon</SheetTitle>
                  <SheetDescription>Find your next class and manage your learning.</SheetDescription>
                </SheetHeader>
                <form className="px-6 flex gap-2" onSubmit={e => { e.preventDefault(); if (searchQuery.trim()) { setMobileOpen(false); navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); } }}>
                  <Input aria-label="Search classes" placeholder="Search classes" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  <Button type="submit" size="icon" aria-label="Search"><Search className="h-4 w-4" /></Button>
                </form>
                <nav aria-label="Mobile navigation" className="px-4 pb-6 space-y-1">
                  {[
                    ['/', 'Home'], ['/browse', 'Browse'], ['/categories', 'Categories'], ['/teach', 'Teach'],
                    ...(isAuthenticated ? [['/my-classes', 'My Classes'], ...(user?.role === 'instructor' ? [['/instructor/dashboard', 'Teacher Dashboard']] : []), ['/notifications', 'Notifications'], ['/profile', 'Profile'], ['/settings', 'Settings']] : [['/login', 'Log In'], ['/signup', 'Sign Up']]),
                    ['/help', 'Help'],
                  ].map(([to, label]) => <SheetClose asChild key={to}><Link to={to} className="block rounded-xl px-4 py-3 font-medium hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-black">{label}</Link></SheetClose>)}
                  {isAuthenticated && <button type="button" onClick={handleLogout} className="w-full text-left rounded-xl px-4 py-3 font-medium text-red-600 hover:bg-red-50">Log Out</button>}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
