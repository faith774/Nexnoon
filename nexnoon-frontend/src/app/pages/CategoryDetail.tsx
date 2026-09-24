import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { classService } from '@/lib/api';
import { ENV } from '@/config/env';
import { 
  Code, 
  Palette, 
  TrendingUp, 
  Briefcase, 
  Camera, 
  Music,
  Heart,
  Globe,
  SlidersHorizontal,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import ClassBrowseCard from '@/app/components/ClassBrowseCard';
import { Button } from '@/app/components/ui/button';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

// Category metadata
const categoryData: Record<string, {
  name: string;
  icon: any;
  description: string;
  image: string;
  color: string;
  totalClasses: string;
}> = {
  'development': {
    name: 'Development',
    icon: Code,
    description: 'Master programming, web development, mobile apps, and software engineering with live expert instruction.',
    image: 'https://images.unsplash.com/photo-1565229284535-2cbbe3049123?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9ncmFtbWluZyUyMGNvZGluZyUyMGRldmVsb3BlcnxlbnwxfHx8fDE3Njg3NDEzMjF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    color: 'from-blue-500 to-blue-600',
    totalClasses: ''
  },
  'design': {
    name: 'Design',
    icon: Palette,
    description: 'Learn UI/UX design, graphic design, web design, and creative visual arts from industry professionals.',
    image: 'https://images.unsplash.com/photo-1624901344246-8759f305fef3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMGRlc2lnbiUyMGFydHxlbnwxfHx8fDE3Njg4MDQ3ODR8MA&ixlib=rb-4.1.0&q=80&w=1080',
    color: 'from-purple-500 to-purple-600',
    totalClasses: ''
  },
  'marketing': {
    name: 'Marketing',
    icon: TrendingUp,
    description: 'Explore digital marketing, SEO, social media, content strategy, and growth hacking techniques.',
    image: 'https://images.unsplash.com/photo-1702047094974-a3475a6e37f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXJrZXRpbmclMjBkaWdpdGFsJTIwd29ya3NwYWNlfGVufDF8fHx8MTc2ODgwNDc4NHww&ixlib=rb-4.1.0&q=80&w=1080',
    color: 'from-green-500 to-green-600',
    totalClasses: ''
  },
  'business': {
    name: 'Business',
    icon: Briefcase,
    description: 'Develop business strategy, entrepreneurship, management, and leadership skills for career growth.',
    image: 'https://images.unsplash.com/photo-1766867264693-e34f484d3371?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMHRlYWNoaW5nfGVufDF8fHx8MTc2ODgwNDc4NHww&ixlib=rb-4.1.0&q=80&w=1080',
    color: 'from-orange-500 to-orange-600',
    totalClasses: ''
  },
  'photography': {
    name: 'Photography',
    icon: Camera,
    description: 'Master photography techniques, photo editing, videography, and visual storytelling.',
    image: 'https://images.unsplash.com/photo-1613398773682-9e272a85f203?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0ZWNobm9sb2d5JTIwbGFwdG9wfGVufDF8fHx8MTc2ODgwMDY2Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    color: 'from-pink-500 to-pink-600',
    totalClasses: ''
  },
  'music': {
    name: 'Music',
    icon: Music,
    description: 'Learn music production, instrument mastery, music theory, and audio engineering.',
    image: 'https://images.unsplash.com/photo-1759984782106-4b56d0aa05b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBsZWFybmluZyUyMHN0dWRlbnR8ZW58MXx8fHwxNzY4ODAyMjUyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    color: 'from-red-500 to-red-600',
    totalClasses: ''
  },
  'health-wellness': {
    name: 'Health & Wellness',
    icon: Heart,
    description: 'Discover fitness, nutrition, yoga, meditation, and holistic wellness practices.',
    image: 'https://images.unsplash.com/photo-1759984782106-4b56d0aa05b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBsZWFybmluZyUyMHN0dWRlbnR8ZW58MXx8fHwxNzY4ODAyMjUyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    color: 'from-[#889dd1] to-[#7a8ec2]',
    totalClasses: ''
  },
  'languages': {
    name: 'Languages',
    icon: Globe,
    description: 'Learn new languages, improve communication skills, and explore world cultures.',
    image: 'https://images.unsplash.com/photo-1613398773682-9e272a85f203?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0ZWNobm9sb2d5JTIwbGFwdG9wfGVufDF8fHx8MTc2ODgwMDY2Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    color: 'from-indigo-500 to-indigo-600',
    totalClasses: ''
  }
};

export default function CategoryDetail() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('popular');
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, Infinity]);
  const [showFilters, setShowFilters] = useState(false);
  const useRealData = !ENV.ENABLE_DEMO_MODE;
  type ClassItem = { id: string | number; title: string; instructor: string; rating: number; students: number; price: number; duration: string; level: string; thumbnail: string; nextSession: string };
  const [totalClasses, setTotalClasses] = useState(0);
  const [apiError, setApiError] = useState('');
  const [apiClasses, setApiClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    if (!useRealData || !category) return;
    classService.getClassesByCategory(category, { pageSize: 50 })
      .then((res) => {
        setApiError(''); setTotalClasses(res.pagination.totalItems);
        const list = (res.data || []).map((c: { id: string; title: string; instructor?: { name?: string }; rating?: number; enrolledStudents?: number; price?: number; duration?: number; level?: string; thumbnail?: string }) => ({
          id: c.id,
          title: c.title,
          instructor: typeof c.instructor === 'object' && c.instructor?.name ? c.instructor.name : 'Instructor',
          rating: c.rating ?? 0,
          students: c.enrolledStudents ?? 0,
          price: c.price ?? 0,
          duration: c.duration ? `${c.duration} min` : 'N/A',
          level: c.level ?? 'Beginner',
          thumbnail: c.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400',
          nextSession: 'Check schedule',
        }));
        setApiClasses(list);
      })
      .catch(() => { setApiClasses([]); setApiError('Unable to load classes. Please try again.'); });
  }, [useRealData, category]);

  const categoryInfo = category ? categoryData[category] || { name: category.replace(/-/g, ' '), icon: BookOpen, description: 'Live classes from our instructors.', image: '', color: 'from-gray-700 to-gray-900', totalClasses: '' } : null;

  if (!categoryInfo) {
    return (
      <div className="min-h-screen bg-white">
        <Header variant="light" />
        <main className="py-20">
          <div className="w-[90vw] max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-black/90 mb-4">Category Not Found</h1>
            <p className="text-black/70 mb-8">The category you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/categories')} className="bg-[#889dd1] text-white hover:bg-[#7a8ec2]">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Categories
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Filter and sort the returned backend classes.
  let filteredClasses = [...apiClasses];

  // Filter by level
  if (levelFilter.length > 0) {
    filteredClasses = filteredClasses.filter(cls => levelFilter.includes(cls.level));
  }

  // Filter by price range
  filteredClasses = filteredClasses.filter(cls => cls.price >= priceRange[0] && cls.price <= priceRange[1]);

  // Apply sorting
  filteredClasses.sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return 0; // API returns newest classes first.
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      case 'popular':
      default:
        return b.students - a.students;
    }
  });

  const toggleLevelFilter = (level: string) => {
    setLevelFilter(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  const Icon = categoryInfo.icon;

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main>
        {apiError && <p role="alert" className="p-4 text-red-600">{apiError}</p>}
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-black/90 to-black/80 py-20">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <ImageWithFallback
              src={categoryInfo.image}
              alt={categoryInfo.name}
              className="w-full h-full object-cover opacity-20"
            />
          </div>

          {/* Content */}
          <div className="relative z-10 w-[90vw] max-w-6xl mx-auto">
            <Button
              onClick={() => navigate('/categories')}
              variant="outline"
              className="mb-6 border-white/30 text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Categories
            </Button>

            <div className="flex items-start gap-6">
              <div className={`hidden md:flex p-6 rounded-2xl bg-gradient-to-br ${categoryInfo.color} shadow-xl`}>
                <Icon className="h-16 w-16 text-white" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4 md:hidden">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${categoryInfo.color}`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white">
                    {categoryInfo.name}
                  </h1>
                </div>

                <h1 className="hidden md:block text-4xl lg:text-5xl font-bold text-white mb-4">
                  {categoryInfo.name}
                </h1>
                
                <p className="text-lg text-white/90 mb-6 max-w-3xl">
                  {categoryInfo.description}
                </p>
                
                <div className="flex flex-wrap items-center gap-6 text-white/80">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <span className="font-medium">{totalClasses.toLocaleString()} Live Classes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">All Skill Levels</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Filters and Classes */}
        <section className="py-12">
          <div className="w-[90vw] max-w-6xl mx-auto">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-black/90 mb-1">
                  Available Classes
                </h2>
                <p className="text-black/70">
                  {filteredClasses.length} live classes found
                </p>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="border-black/20 text-black/80"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-black/20 rounded-lg text-black/80 bg-white hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#889dd1]"
                >
                  <option value="popular">Most Popular</option>
                  <option value="newest">Newest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="bg-gray-100 p-4 rounded-lg mb-4">
                <h3 className="text-xl font-bold mb-2">Skill Level</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    className={`border-black/20 text-black/80 ${levelFilter.includes('Beginner') ? 'bg-[#889dd1] text-white' : ''}`}
                    onClick={() => toggleLevelFilter('Beginner')}
                  >
                    Beginner
                  </Button>
                  <Button
                    variant="outline"
                    className={`border-black/20 text-black/80 ${levelFilter.includes('Intermediate') ? 'bg-[#889dd1] text-white' : ''}`}
                    onClick={() => toggleLevelFilter('Intermediate')}
                  >
                    Intermediate
                  </Button>
                  <Button
                    variant="outline"
                    className={`border-black/20 text-black/80 ${levelFilter.includes('Advanced') ? 'bg-[#889dd1] text-white' : ''}`}
                    onClick={() => toggleLevelFilter('Advanced')}
                  >
                    Advanced
                  </Button>
                </div>

                <h3 className="text-xl font-bold mt-4 mb-2">Price Range</h3>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                    className="px-4 py-2 border border-black/20 rounded-lg text-black/80 bg-white hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#889dd1]"
                    min="0"
                  />
                  <span className="text-black/80">to</span>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="px-4 py-2 border border-black/20 rounded-lg text-black/80 bg-white hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#889dd1]"
                    min="0"
                  />
                </div>
              </div>
            )}

            {/* Classes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 max-w-[1328px] mx-auto justify-items-center">
              {filteredClasses.map((classItem) => (
                <ClassBrowseCard
                  key={String(classItem.id)}
                  data={{
                    id: String(classItem.id),
                    title: classItem.title,
                    instructor: classItem.instructor,
                    price: classItem.price,
                    currency: 'USD',
                    image: classItem.thumbnail,
                    duration: classItem.duration === 'N/A' ? '' : classItem.duration,
                    level: classItem.level,
                    enrolledStudents: classItem.students,
                  }}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}