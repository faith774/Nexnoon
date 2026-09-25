import BrandLoader from './components/BrandLoader';
import { createBrowserRouter, Navigate, RouterProvider, useLocation, type RouteObject } from "react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { RouteErrorBoundary } from "@/app/components/RouteErrorBoundary";
import { ScrollToTop } from "@/app/components/ScrollToTop";
import { Layout } from "@/app/components/Layout";
import Header from "@/app/components/Header";
import Hero from "@/app/components/Hero";
import LiveClasses from "@/app/components/LiveClasses";
import CourseBrowseCard from "@/app/components/CourseBrowseCard";
import Footer from "@/app/components/Footer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, lazy, Suspense, useEffect, type ReactNode } from "react";
import { courseService } from "@/lib/api";
import { adminPortalHref, adminPortalIsExternal, isAdminPortalHost, publicSiteHref } from "@/lib/portal";
import type { Course } from "@/types/api";

// Lazy load all page components for better performance
const About = lazy(() => import("@/app/pages/About"));
const AdminDashboard = lazy(() => import("@/app/pages/AdminDashboard"));
const AdminLogin = lazy(() => import("@/app/pages/AdminLogin"));
const Analytics = lazy(() => import("@/app/pages/Analytics"));
const Assignments = lazy(() => import("@/app/pages/Assignments"));
const Browse = lazy(() => import("@/app/pages/Browse"));
const Categories = lazy(() => import("@/app/pages/Categories"));
const CategoryDetail = lazy(() => import("@/app/pages/CategoryDetail"));
const Certificate = lazy(() => import("@/app/pages/Certificate"));
const CertificateView = lazy(() => import("@/app/pages/CertificateView"));
const ClassDetail = lazy(() => import("@/app/pages/ClassDetail"));
const ClassRoom = lazy(() => import("@/app/pages/ClassRoom"));
const Contact = lazy(() => import("@/app/pages/Contact"));
const CoursePage = lazy(() => import("@/app/pages/CoursePage"));
const CreateClass = lazy(() => import("@/app/pages/CreateClass"));
const Earnings = lazy(() => import("@/app/pages/Earnings"));
const EditClass = lazy(() => import("@/app/pages/EditClass"));
const EnrollmentSuccess = lazy(() => import("@/app/pages/EnrollmentSuccess"));
const ForgotPassword = lazy(() => import("@/app/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/app/pages/ResetPassword"));
const VerifyEmail = lazy(() => import("@/app/pages/VerifyEmail"));
const ChangePassword = lazy(() => import("@/app/pages/ChangePassword"));
const Help = lazy(() => import("@/app/pages/Help"));
const InstructorDashboard = lazy(() => import("@/app/pages/InstructorDashboard"));
const InstructorApplication = lazy(() => import("@/app/pages/InstructorApplication"));
const InstructorPendingApproval = lazy(() => import("@/app/pages/InstructorPendingApproval"));
const InstructorPublicProfile = lazy(() => import("@/app/pages/InstructorPublicProfile"));
const LiveSession = lazy(() => import("@/app/pages/LiveSession"));
const Login = lazy(() => import("@/app/pages/Login"));
const Materials = lazy(() => import("@/app/pages/Materials"));
const MyClasses = lazy(() => import("@/app/pages/MyClasses"));
const NotFound = lazy(() => import("@/app/pages/NotFound"));
const Notifications = lazy(() => import("@/app/pages/Notifications"));
const Payment = lazy(() => import("@/app/pages/Payment"));
const Privacy = lazy(() => import("@/app/pages/Privacy"));
const Profile = lazy(() => import("@/app/pages/Profile"));
const RecordedClass = lazy(() => import("@/app/pages/RecordedClass"));
const Search = lazy(() => import("@/app/pages/Search"));
const Settings = lazy(() => import("@/app/pages/Settings"));
const Signup = lazy(() => import("@/app/pages/Signup"));
const StudentsManagement = lazy(() => import("@/app/pages/StudentsManagement"));
const Teach = lazy(() => import("@/app/pages/Teach"));
const Terms = lazy(() => import("@/app/pages/Terms"));
const WaitingRoom = lazy(() => import("@/app/pages/WaitingRoom"));

// Loading fallback component
function LoadingFallback() { return <BrandLoader fullScreen />; }

function Home() {
  const categories = [
    "All",
    "Development",
    "Design",
    "Marketing",
    "Business",
    "Technology",
    "Photography",
    "Music",
    "Health & Wellness",
    "Personal Development",
    "Teaching",
    "Data Science",
    "Finance",
    "Languages",
    "Lifestyle"
  ];
  const [activeCategory, setActiveCategory] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    courseService
      .getCatalog()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  const nextCategory = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const prevCategory = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      <main>
        <Hero variant="browse" />

        {courses.length > 0 ? (
          <section className="pt-8 sm:pt-10 pb-6 bg-white border-b border-[#ebe6de]">
            <div className="w-[90vw] mx-auto">
              <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a847a] mb-2">
                  Official courses
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-black tracking-tight">
                  Pick a course, then a language
                </h2>
                <p className="mt-2 text-black/60 max-w-2xl">
                  Standardized products taught by certified instructors — choose language and join a live cohort.
                </p>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {courses.map((c) => (
                  <div key={c.id} className="shrink-0 w-[min(86vw,340px)]">
                    <CourseBrowseCard course={c} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="pt-4 sm:pt-6 pb-8 sm:pb-12 bg-white">
          <div className="w-[90vw] mx-auto">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black mb-3 sm:mb-4">
                Explore live classes
              </h2>
              <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
                Browse open cohorts by topic — or start from a course above for the full path.
              </p>
            </div>
          </div>
        </section>
        <section className="pb-2 bg-white sticky top-16 z-20 shadow-sm">
          <div className="w-[90vw] mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={prevCategory}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 -ml-8"
                aria-label="Previous category"
              >
                <ChevronLeft className="h-6 w-6 text-black" />
              </button>
              <nav className="flex items-center justify-start flex-1 gap-1.5 overflow-x-auto overflow-y-hidden scrollbar-hide" ref={scrollContainerRef} style={{ scrollbarWidth: 'none' }}>
                {categories.map((category, index) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(index)}
                    className={`text-sm font-bold transition-colors whitespace-nowrap px-4 py-2 rounded-md cursor-pointer flex-shrink-0 ${
                      activeCategory === index
                        ? "bg-black text-white"
                        : "text-black/70 hover:text-black hover:bg-gray-100"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </nav>
              <button
                onClick={nextCategory}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 -mr-8"
                aria-label="Next category"
              >
                <ChevronRight className="h-6 w-6 text-black" />
              </button>
            </div>
          </div>
        </section>
        <LiveClasses
          title={categories[activeCategory]}
          showTitle={false}
          variant="large"
          showBorderHover={false}
          selectedCategory={categories[activeCategory]}
          showLoadMore={true}
        />
      </main>
      <Footer />
    </div>
  );
}

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <LoadingFallback />;
}

/** On the public site, forwards /admin/* to the admin portal origin when one is configured. */
function AdminEntry({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (adminPortalIsExternal()) {
    return <ExternalRedirect to={adminPortalHref(location.pathname + location.search)} />;
  }
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}

/** On the admin portal, sends public-site paths (class pages, profiles…) back to the public site. */
function PublicPathFromAdmin() {
  const location = useLocation();
  const target = publicSiteHref(location.pathname + location.search);
  if (/^https?:\/\//.test(target)) return <ExternalRedirect to={target} />;
  return <Navigate to="/admin/dashboard" replace />;
}

const adminPortalRoutes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/", element: <Navigate to="/admin/dashboard" replace /> },
      { path: "/login", element: <Navigate to="/admin/login" replace /> },
      {
        path: "/admin/login",
        element: <Suspense fallback={<LoadingFallback />}><AdminLogin /></Suspense>,
      },
      {
        path: "/admin/dashboard",
        element: <Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense>,
      },
      {
        path: "/admin",
        element: <Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense>,
      },
      {
        path: "/admin/classes/:id/edit",
        element: <Suspense fallback={<LoadingFallback />}><EditClass /></Suspense>,
      },
      {
        path: "/change-password",
        element: <Suspense fallback={<LoadingFallback />}><ChangePassword /></Suspense>,
      },
      { path: "*", element: <PublicPathFromAdmin /> },
    ],
  },
];

const siteRoutes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/browse",
        element: <Home />,
      },
      {
        path: "/about",
        element: <Suspense fallback={<LoadingFallback />}><About /></Suspense>,
      },
      {
        path: "/admin/login",
        element: <AdminEntry><AdminLogin /></AdminEntry>,
      },
      {
        path: "/admin/dashboard",
        element: <AdminEntry><AdminDashboard /></AdminEntry>,
      },
      {
        path: "/admin",
        element: <AdminEntry><AdminDashboard /></AdminEntry>,
      },
      {
        path: "/admin/classes/:id/edit",
        element: <AdminEntry><EditClass /></AdminEntry>,
      },
      {
        path: "/analytics",
        element: <Suspense fallback={<LoadingFallback />}><Analytics /></Suspense>,
      },
      {
        path: "/assignments/:id?",
        element: <Suspense fallback={<LoadingFallback />}><Assignments /></Suspense>,
      },
      {
        path: "/",
        element: <Suspense fallback={<LoadingFallback />}><Browse /></Suspense>,
      },
      {
        path: "/categories",
        element: <Suspense fallback={<LoadingFallback />}><Categories /></Suspense>,
      },
      {
        path: "/category/:category",
        element: <Suspense fallback={<LoadingFallback />}><CategoryDetail /></Suspense>,
      },
      {
        path: "/certificates/:certificateId",
        element: <Suspense fallback={<LoadingFallback />}><CertificateView /></Suspense>,
      },
      {
        path: "/certificate/:id",
        element: <Suspense fallback={<LoadingFallback />}><Certificate /></Suspense>,
      },
      {
        path: "/class/:id/:titleSlug?",
        element: <Suspense fallback={<LoadingFallback />}><ClassDetail /></Suspense>,
      },
      {
        path: "/classroom/:id",
        element: <Suspense fallback={<LoadingFallback />}><ClassRoom /></Suspense>,
      },
      {
        path: "/contact",
        element: <Suspense fallback={<LoadingFallback />}><Contact /></Suspense>,
      },
      {
        path: "/courses/:slug",
        element: <Suspense fallback={<LoadingFallback />}><CoursePage /></Suspense>,
      },
      {
        path: "/create-class",
        element: <Suspense fallback={<LoadingFallback />}><CreateClass /></Suspense>,
      },
      {
        path: "/earnings",
        element: <Suspense fallback={<LoadingFallback />}><Earnings /></Suspense>,
      },
      {
        path: "/edit-class/:id",
        element: <Suspense fallback={<LoadingFallback />}><EditClass /></Suspense>,
      },
      {
        path: "/enrollment-success/:id",
        element: <Suspense fallback={<LoadingFallback />}><EnrollmentSuccess /></Suspense>,
      },
      {
        path: "/forgot-password",
        element: <Suspense fallback={<LoadingFallback />}><ForgotPassword /></Suspense>,
      },
      {
        path: "/reset-password",
        element: <Suspense fallback={<LoadingFallback />}><ResetPassword /></Suspense>,
      },
      {
        path: "/verify-email",
        element: <Suspense fallback={<LoadingFallback />}><VerifyEmail /></Suspense>,
      },
      {
        path: "/change-password",
        element: <Suspense fallback={<LoadingFallback />}><ChangePassword /></Suspense>,
      },
      {
        path: "/help",
        element: <Suspense fallback={<LoadingFallback />}><Help /></Suspense>,
      },
      {
        path: "/instructor/dashboard",
        element: <Suspense fallback={<LoadingFallback />}><InstructorDashboard /></Suspense>,
      },
      {
        path: "/instructor/application",
        element: <Suspense fallback={<LoadingFallback />}><InstructorApplication /></Suspense>,
      },
      {
        path: "/instructor/pending-approval",
        element: <Suspense fallback={<LoadingFallback />}><InstructorPendingApproval /></Suspense>,
      },
      {
        path: "/instructors/:id",
        element: <Suspense fallback={<LoadingFallback />}><InstructorPublicProfile /></Suspense>,
      },
      {
        path: "/live-session/:id",
        element: <Suspense fallback={<LoadingFallback />}><LiveSession /></Suspense>,
      },
      {
        path: "/login",
        element: <Suspense fallback={<LoadingFallback />}><Login /></Suspense>,
      },
      {
        path: "/materials/:id?",
        element: <Suspense fallback={<LoadingFallback />}><Materials /></Suspense>,
      },
      {
        path: "/my-classes",
        element: <Suspense fallback={<LoadingFallback />}><MyClasses /></Suspense>,
      },
      {
        path: "/notifications",
        element: <Suspense fallback={<LoadingFallback />}><Notifications /></Suspense>,
      },
      {
        path: "/payment/:id",
        element: <Suspense fallback={<LoadingFallback />}><Payment /></Suspense>,
      },
      {
        path: "/privacy",
        element: <Suspense fallback={<LoadingFallback />}><Privacy /></Suspense>,
      },
      {
        path: "/profile",
        element: <Suspense fallback={<LoadingFallback />}><Profile /></Suspense>,
      },
      {
        path: "/recorded-class/:id",
        element: <Suspense fallback={<LoadingFallback />}><RecordedClass /></Suspense>,
      },
      {
        path: "/search",
        element: <Suspense fallback={<LoadingFallback />}><Search /></Suspense>,
      },
      {
        path: "/settings",
        element: <Suspense fallback={<LoadingFallback />}><Settings /></Suspense>,
      },
      {
        path: "/signup",
        element: <Suspense fallback={<LoadingFallback />}><Signup /></Suspense>,
      },
      {
        path: "/students-management",
        element: <Suspense fallback={<LoadingFallback />}><StudentsManagement /></Suspense>,
      },
      {
        path: "/teach",
        element: <Suspense fallback={<LoadingFallback />}><Teach /></Suspense>,
      },
      {
        path: "/terms",
        element: <Suspense fallback={<LoadingFallback />}><Terms /></Suspense>,
      },
      {
        path: "/waiting-room/:id",
        element: <Suspense fallback={<LoadingFallback />}><WaitingRoom /></Suspense>,
      },
      {
        path: "*",
        element: <Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>,
      },
    ],
  },
];

const router = createBrowserRouter(isAdminPortalHost() ? adminPortalRoutes : siteRoutes, {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
});

export default function App() {
  return (
    <AuthProvider>
      <QueryProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </QueryProvider>
    </AuthProvider>
  );
}
