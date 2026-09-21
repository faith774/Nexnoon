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
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";

const categories = [
  {
    id: 1,
    name: "Development",
    icon: Code,
    courses: "2,500+ live classes",
    image: "https://images.unsplash.com/photo-1565229284535-2cbbe3049123?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9ncmFtbWluZyUyMGNvZGluZyUyMGRldmVsb3BlcnxlbnwxfHx8fDE3Njg3NDEzMjF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-blue-500 to-blue-600"
  },
  {
    id: 2,
    name: "Design",
    icon: Palette,
    courses: "1,800+ live classes",
    image: "https://images.unsplash.com/photo-1624901344246-8759f305fef3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMGRlc2lnbiUyMGFydHxlbnwxfHx8fDE3Njg4MDQ3ODR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-purple-500 to-purple-600"
  },
  {
    id: 3,
    name: "Marketing",
    icon: TrendingUp,
    courses: "1,200+ live classes",
    image: "https://images.unsplash.com/photo-1702047094974-a3475a6e37f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXJrZXRpbmclMjBkaWdpdGFsJTIwd29ya3NwYWNlfGVufDF8fHx8MTc2ODgwNDc4NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-green-500 to-green-600"
  },
  {
    id: 4,
    name: "Business",
    icon: Briefcase,
    courses: "1,500+ live classes",
    image: "https://images.unsplash.com/photo-1766867264693-e34f484d3371?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMHRlYWNoaW5nfGVufDF8fHx8MTc2ODgwNDc4NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-orange-500 to-orange-600"
  },
  {
    id: 5,
    name: "Photography",
    icon: Camera,
    courses: "900+ live classes",
    image: "https://images.unsplash.com/photo-1613398773682-9e272a85f203?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0ZWNobm9sb2d5JTIwbGFwdG9wfGVufDF8fHx8MTc2ODgwMDY2Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-pink-500 to-pink-600"
  },
  {
    id: 6,
    name: "Music",
    icon: Music,
    courses: "750+ live classes",
    image: "https://images.unsplash.com/photo-1759984782106-4b56d0aa05b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBsZWFybmluZyUyMHN0dWRlbnR8ZW58MXx8fHwxNzY4ODAyMjUyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-red-500 to-red-600"
  },
  {
    id: 7,
    name: "Health & Wellness",
    icon: Heart,
    courses: "650+ live classes",
    image: "https://images.unsplash.com/photo-1759984782106-4b56d0aa05b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBsZWFybmluZyUyMHN0dWRlbnR8ZW58MXx8fHwxNzY4ODAyMjUyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-[#889dd1] to-[#7a8ec5]"
  },
  {
    id: 8,
    name: "Languages",
    icon: Globe,
    courses: "1,100+ live classes",
    image: "https://images.unsplash.com/photo-1613398773682-9e272a85f203?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0ZWNobm9sb2d5JTIwbGFwdG9wfGVufDF8fHx8MTc2ODgwMDY2Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    color: "from-indigo-500 to-indigo-600"
  }
];

function CourseCategories() {
  return (
    <section id="categories" className="pt-4 sm:pt-6 lg:pt-8 pb-12 sm:pb-16 lg:pb-24 bg-white scroll-mt-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            Explore Live Classes
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto px-4">
            Explore Live Classes to enhance your learning experience.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <div
                key={category.id}
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200 transition-all duration-300 cursor-pointer"
              >
                {/* Image Background */}
                <div className="relative h-40 sm:h-48 overflow-hidden">
                  <ImageWithFallback
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {/* Gradient Overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-60 group-hover:opacity-70 transition-opacity`}></div>
                </div>

                {/* Content */}
                <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-end">
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl p-3 sm:p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <div className="flex items-center space-x-2 sm:space-x-3 mb-1 sm:mb-2">
                      <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${category.color}`}>
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base text-gray-900">
                        {category.name}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">{category.courses}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All Button */}
        <div className="text-center mt-8 sm:mt-12">
          <button className="px-6 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-[#889dd1] bg-[#889dd1]/10 rounded-full hover:bg-[#889dd1]/20 transition-colors">
            View All Categories
          </button>
        </div>
      </div>
    </section>
  );
}

export default CourseCategories;