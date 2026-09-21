import BrandLoader from './components/BrandLoader';
import { createBrowserRouter, RouterProvider } from "react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { RouteErrorBoundary } from "@/app/components/RouteErrorBoundary";
import { ScrollToTop } from "@/app/components/ScrollToTop";
import { Layout } from "@/app/components/Layout";
import Header from "@/app/components/Header";
import Hero from "@/app/components/Hero";
import LiveClasses from "@/app/components/LiveClasses";
import Footer from "@/app/components/Footer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, lazy, Suspense } from "react";

// Lazy load all page components for better performance
const About = lazy(() => import("@/app/pages/About"));
const AdminDashboard = lazy(() => import("@/app/pages/AdminDashboard"));
const Analytics = lazy(() => import("@/app/pages/Analytics"));
const Assignments = lazy(() => import("@/app/pages/Assignments"));
const Browse = lazy(() => import("@/app/pages/Browse"));
const Categories = lazy(() => import("@/app/pages/Categories"));
const CategoryDetail = lazy(() => import("@/app/pages/CategoryDetail"));
const Certificate = lazy(() => import("@/app/pages/Certificate"));
const ClassDetail = lazy(() => import("@/app/pages/ClassDetail"));
const ClassRoom = lazy(() => import("@/app/pages/ClassRoom"));
const Contact = lazy(() => import("@/app/pages/Contact"));
const CreateClass = lazy(() => import("@/app/pages/CreateClass"));
const Earnings = lazy(() => import("@/app/pages/Earnings"));
const EditClass = lazy(() => import("@/app/pages/EditClass"));
const EnrollmentSuccess = lazy(() => import("@/app/pages/EnrollmentSuccess"));
const ForgotPassword = lazy(() => import("@/app/pages/ForgotPassword"));
const Help = lazy(() => import("@/app/pages/Help"));
const InstructorDashboard = lazy(() => import("@/app/pages/InstructorDashboard"));
const InstructorPendingApproval = lazy(() => import("@/app/pages/InstructorPendingApproval"));
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
        <section className="pt-4 sm:pt-6 pb-8 sm:pb-12 bg-white">
          <div className="w-[90vw] mx-auto">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black mb-3 sm:mb-4">
                Explore Live Classes
              </h2>
              <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
                Explore Live Classes to enhance your learning experience.
              </p>
            </div>
          </div>
        </section>
        <section className="pb-2 bg-white sticky top-16 z-40 shadow-sm">
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

const router = createBrowserRouter([
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
        path: "/admin/dashboard",
        element: <Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense>,
      },
      {
        path: "/admin",
        element: <Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense>,
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
        path: "/help",
        element: <Suspense fallback={<LoadingFallback />}><Help /></Suspense>,
      },
      {
        path: "/instructor/dashboard",
        element: <Suspense fallback={<LoadingFallback />}><InstructorDashboard /></Suspense>,
      },
      {
        path: "/instructor/pending-approval",
        element: <Suspense fallback={<LoadingFallback />}><InstructorPendingApproval /></Suspense>,
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
], {
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
