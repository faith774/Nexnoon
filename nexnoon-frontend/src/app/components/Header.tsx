import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription, SheetClose } from '@/app/components/ui/sheet';
import { useBackendData } from '@/hooks/useBackendData';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Compass,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Presentation,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import ClassSearchAutocomplete from '@/app/components/ClassSearchAutocomplete';
import AdminPortalHeader from '@/app/components/AdminPortalHeader';
import { isAdminPortalHost } from '@/lib/portal';

interface HeaderProps {
  variant?: 'default' | 'light';
}

export default function Header(props: HeaderProps) {
  return isAdminPortalHost() ? <AdminPortalHeader /> : <SiteHeader {...props} />;
}

type NavItem = { to: string; label: string; icon: LucideIcon };

function Logo() {
  return (
    <Link to="/" className="group flex items-center" aria-label="Nexnoon home">
      <span className="text-[22px] font-bold tracking-tight text-[#14110e]">
        Nexnoon<span className="text-[#889dd1] transition-colors group-hover:text-[#c45c26]">.</span>
      </span>
    </Link>
  );
}

function Avatar({ name, size = 'md' }: { name?: string; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-11 w-11 text-base' : 'h-8 w-8 text-sm';
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-[#14110e] font-semibold text-white ring-2 ring-white`}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

const roleLabel = (role?: string) =>
  role === 'admin' ? 'Admin' : role === 'instructor' ? 'Instructor' : 'Learner';

function SiteHeader(_props: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const unread = useBackendData<{ pagination: { totalItems: number } }>('/notifications?unread=true&pageSize=1');
  const unreadCount = unread.data?.pagination.totalItems || 0;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 4);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!showUserMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showUserMenu]);

  useEffect(() => {
    setShowUserMenu(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMobileOpen(false);
    setShowUserMenu(false);
    logout();
    navigate('/');
  };

  const teachHref =
    isAuthenticated && user?.role === 'instructor'
      ? user.instructorStatus === 'approved'
        ? '/instructor/dashboard'
        : '/instructor/pending-approval'
      : '/teach';

  const primaryNav: NavItem[] = [
    { to: '/browse', label: 'Browse', icon: Compass },
    { to: '/categories', label: 'Categories', icon: LayoutGrid },
    { to: teachHref, label: 'Teach', icon: Presentation },
  ];

  const accountNav: NavItem[] = [
    { to: '/my-classes', label: 'My classes', icon: BookOpen },
    ...(user?.role === 'instructor' ? [{ to: '/instructor/dashboard', label: 'Instructor studio', icon: GraduationCap }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin/dashboard', label: 'Admin dashboard', icon: ShieldCheck }] : []),
    { to: '/profile', label: 'Profile', icon: User },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-[#f3f1ec] text-[#14110e]' : 'text-[#5c574f] hover:text-[#14110e]'
    }`;

  const iconBtn =
    'relative flex h-9 w-9 items-center justify-center rounded-full text-[#5c574f] transition-colors hover:bg-[#f3f1ec] hover:text-[#14110e]';

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md transition-shadow duration-300 ${
        isScrolled ? 'border-[#ebe6de] shadow-[0_6px_20px_-12px_rgba(20,17,14,0.25)]' : 'border-[#ebe6de]/70'
      }`}
    >
      <div className="mx-auto flex h-16 w-[90vw] items-center gap-4 lg:gap-6">
        <Logo />

        <div className="hidden min-w-0 flex-1 md:block lg:max-w-md">
          <ClassSearchAutocomplete
            variant="header"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="What do you want to learn?"
          />
        </div>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex lg:ml-auto">
          {primaryNav.map((item) => (
            <NavLink key={item.label} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {isAuthenticated ? (
            <>
              <Link to="/help" aria-label="Help" className={`${iconBtn} hidden lg:flex`}>
                <HelpCircle className="h-[18px] w-[18px]" />
              </Link>
              <Link
                to="/notifications"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                className={`${iconBtn} hidden sm:flex`}
              >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#c45c26] ring-2 ring-white" />
                ) : null}
              </Link>
              <Link
                to="/my-classes"
                className="ml-1 hidden items-center rounded-full border border-[#e0dbd2] px-4 py-2 text-sm font-medium text-[#14110e] transition-colors hover:border-[#14110e] lg:inline-flex"
              >
                My classes
              </Link>

              <div ref={menuRef} className="relative ml-1 hidden sm:block">
                <button
                  type="button"
                  onClick={() => setShowUserMenu((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                  aria-label="Account menu"
                  className="flex items-center gap-1 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-[#f3f1ec]"
                >
                  <Avatar name={user?.name} />
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-[#8a847a] transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  />
                </button>

                {showUserMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-[#ebe6de] bg-white shadow-[0_20px_50px_-20px_rgba(20,17,14,0.35)]"
                  >
                    <div className="flex items-center gap-3 border-b border-[#f0ece5] px-4 py-4">
                      <Avatar name={user?.name} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#14110e]">{user?.name}</p>
                        <p className="truncate text-xs text-[#8a847a]">{user?.email}</p>
                        <span className="mt-1 inline-block rounded-full bg-[#f3f1ec] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5c574f]">
                          {roleLabel(user?.role)}
                        </span>
                      </div>
                    </div>
                    <div className="py-1.5">
                      {accountNav.map((item) => (
                        <Link
                          key={item.label}
                          to={item.to}
                          role="menuitem"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#2b2722] hover:bg-[#faf9f6]"
                        >
                          <item.icon className="h-4 w-4 text-[#8a847a]" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-[#f0ece5] py-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#b4401f] hover:bg-[#fdf3ef]"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-full px-4 py-2 text-sm font-medium text-[#14110e] transition-colors hover:bg-[#f3f1ec] sm:inline-flex"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="inline-flex rounded-full bg-[#14110e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2722]"
              >
                Sign up
              </Link>
            </>
          )}

          <Sheet
            open={mobileOpen}
            onOpenChange={(open) => {
              setMobileOpen(open);
              if (open) setShowUserMenu(false);
            }}
          >
            <SheetTrigger asChild>
              <button type="button" aria-label="Open navigation menu" className={`${iconBtn} md:hidden`}>
                <Menu className="h-5 w-5 text-[#14110e]" />
                {isAuthenticated && unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#c45c26] ring-2 ring-white sm:hidden" />
                ) : null}
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[min(88vw,380px)] flex-col gap-0 overflow-y-auto border-l border-[#ebe6de] bg-white p-0 text-[#14110e]">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Find your next class and manage your learning.</SheetDescription>

              <div className="border-b border-[#f0ece5] px-5 pb-5 pt-5">
                {isAuthenticated ? (
                  <div className="flex items-center gap-3 pr-8">
                    <Avatar name={user?.name} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{user?.name}</p>
                      <p className="truncate text-xs text-[#8a847a]">{user?.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="pr-8">
                    <Logo />
                    <p className="mt-1 text-sm text-[#8a847a]">Live classes, taught by certified instructors.</p>
                  </div>
                )}
                <div className="mt-4">
                  <ClassSearchAutocomplete
                    variant="header"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search classes"
                    onClose={() => setMobileOpen(false)}
                  />
                </div>
              </div>

              <nav aria-label="Mobile navigation" className="flex-1 px-3 py-4">
                <MobileSection
                  title="Explore"
                  items={[{ to: '/', label: 'Home', icon: Home }, ...primaryNav]}
                  pathname={location.pathname}
                />
                {isAuthenticated ? (
                  <MobileSection
                    title="Your account"
                    items={[
                      accountNav[0],
                      { to: '/notifications', label: 'Notifications', icon: Bell },
                      ...accountNav.slice(1),
                    ]}
                    pathname={location.pathname}
                    badge={{ to: '/notifications', count: unreadCount }}
                  />
                ) : null}
                <MobileSection
                  title="Support"
                  items={[{ to: '/help', label: 'Help centre', icon: HelpCircle }]}
                  pathname={location.pathname}
                />
              </nav>

              <div className="border-t border-[#f0ece5] p-5">
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-[#e0dbd2] py-3 text-sm font-semibold text-[#b4401f] hover:border-[#b4401f]"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <SheetClose asChild>
                      <Link to="/login" className="rounded-full border border-[#e0dbd2] py-3 text-center text-sm font-semibold hover:border-[#14110e]">
                        Log in
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link to="/signup" className="rounded-full bg-[#14110e] py-3 text-center text-sm font-semibold text-white hover:bg-[#2b2722]">
                        Sign up
                      </Link>
                    </SheetClose>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileSection({
  title,
  items,
  pathname,
  badge,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  badge?: { to: string; count: number };
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a39d93]">{title}</p>
      <ul>
        {items.map((item) => {
          const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
          return (
            <li key={`${item.to}-${item.label}`}>
              <SheetClose asChild>
                <Link
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                    active ? 'bg-[#f3f1ec] text-[#14110e]' : 'text-[#2b2722] hover:bg-[#faf9f6]'
                  }`}
                >
                  <item.icon className={`h-[18px] w-[18px] ${active ? 'text-[#14110e]' : 'text-[#8a847a]'}`} />
                  {item.label}
                  {badge && badge.to === item.to && badge.count > 0 ? (
                    <span className="ml-auto rounded-full bg-[#c45c26] px-2 py-0.5 text-[11px] font-semibold text-white">
                      {badge.count}
                    </span>
                  ) : null}
                </Link>
              </SheetClose>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
