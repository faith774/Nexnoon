import { useBackendData } from '@/hooks/useBackendData';
import { 
  Code, 
  Palette, 
  TrendingUp, 
  Briefcase, 
  Camera, 
  Music,
  Heart,
  Globe
} from "lucide-react";
import { useNavigate } from "react-router";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const categories = [
  {
    id: 1,
    name: "Development",
    slug: "development",
    icon: Code,
    image: "https://images.unsplash.com/photo-1565229284535-2cbbe3049123?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9ncmFtbWluZyUyMGNvZGluZyUyMGRldmVsb3BlcnxlbnwxfHx8fDE3Njg3NDEzMjF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-blue-500 to-blue-600"
  },
  {
    id: 2,
    name: "Design",
    slug: "design",
    icon: Palette,
    image: "https://images.unsplash.com/photo-1624901344246-8759f305fef3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMGRlc2lnbiUyMGFydHxlbnwxfHx8fDE3Njg4MDQ3ODR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-purple-500 to-purple-600"
  },
  {
    id: 3,
    name: "Marketing",
    slug: "marketing",
    icon: TrendingUp,
    image: "https://images.unsplash.com/photo-1702047094974-a3475a6e37f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXJrZXRpbmclMjBkaWdpdGFsJTIwd29ya3NwYWNlfGVufDF8fHx8MTc2ODgwNDc4NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-green-500 to-green-600"
  },
  {
    id: 4,
    name: "Business",
    slug: "business",
    icon: Briefcase,
    image: "https://images.unsplash.com/photo-1766867264693-e34f484d3371?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMHRlYWNoaW5nfGVufDF8fHx8MTc2ODgwNDc4NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-orange-500 to-orange-600"
  },
  {
    id: 5,
    name: "Photography",
    slug: "photography",
    icon: Camera,
    image: "https://images.unsplash.com/photo-1613398773682-9e272a85f203?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0ZWNobm9sb2d5JTIwbGFwdG9wfGVufDF8fHx8MTc2ODgwMDY2Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-pink-500 to-pink-600"
  },
  {
    id: 6,
    name: "Music",
    slug: "music",
    icon: Music,
    image: "https://images.unsplash.com/photo-1759984782106-4b56d0aa05b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBsZWFybmluZyUyMHN0dWRlbnR8ZW58MXx8fHwxNzY4ODAyMjUyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-red-500 to-red-600"
  },
  {
    id: 7,
    name: "Health & Wellness",
    slug: "health-wellness",
    icon: Heart,
    image: "https://images.unsplash.com/photo-1759984782106-4b56d0aa05b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBsZWFybmluZyUyMHN0dWRlbnR8ZW58MXx8fHwxNzY4ODAyMjUyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-[#889dd1] to-[#7a8ec5]"
  },
  {
    id: 8,
    name: "Languages",
    slug: "languages",
    icon: Globe,
    image: "https://images.unsplash.com/photo-1613398773682-9e272a85f203?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0ZWNobm9sb2d5JTIwbGFwdG9wfGVufDF8fHx8MTc2ODgwMDY2Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-indigo-500 to-indigo-600"
  }
];

export default function Categories() {
  const navigate = useNavigate();
  const categoryQuery = useBackendData<{ name: string; count: number }[]>("/data/categories", true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Header />
      <main>
        {/* Hero Section with Background */}
        <section className="relative overflow-hidden min-h-[400px] h-[50vh] flex items-center">
          {/* Background Image with Modern Overlay */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt="Categories background"
              className="w-full h-full object-cover"
            />
            {/* Pure black/white gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/95 via-black/90 to-black/85"></div>
            
            {/* Subtle geometric accent */}
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-5">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon points="100,0 100,100 50,100" fill="white"/>
              </svg>
            </div>
          </div>

          <div className="w-[90vw] mx-auto relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              {/* Page Header */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                Explore Live Classes
              </h1>
              <p className="text-base sm:text-lg text-gray-200 max-w-2xl mx-auto">
                Explore Live Classes to enhance your learning experience.
              </p>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 lg:py-20">
          <div className="w-[90vw] mx-auto px-4 sm:px-6">
            {/* Categories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <div
                    key={category.id}
                    className="group rounded-2xl overflow-hidden cursor-pointer w-full transition-all duration-300"
                    onClick={() => navigate(`/category/${category.slug}`)}
                  >
                    {/* Image */}
                    <div className="relative h-56 overflow-hidden bg-gray-100 rounded-2xl">
                      <ImageWithFallback
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Icon Badge - positioned at top left */}
                      <div className="absolute top-4 left-4 p-2.5 rounded-full bg-gray-800 shadow-lg z-10">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-[10px] px-[0px] py-[5px]">
                      <h3 className="font-semibold text-base text-gray-900 mb-1 line-clamp-1 group-hover:text-[#889dd1] transition-colors">
                        {category.name}
                      </h3>

                      <div className="flex items-center text-sm text-gray-600 m-[0px] -mt-1 mx-[0px] my-[5px]">
                        <span className="text-[12px]">{categoryQuery.isError ? "Unavailable" : categoryQuery.isPending ? "Loading..." : `${categoryQuery.data?.find(c => c.name === category.name)?.count || 0} live classes`}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
