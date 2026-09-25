import {
  Code2,
  Palette,
  Megaphone,
  Briefcase,
  Camera,
  Music,
  HeartPulse,
  Languages,
  type LucideIcon,
} from 'lucide-react';

export type CategoryMeta = {
  name: string;
  slug: string;
  icon: LucideIcon;
  image: string;
  description: string;
};

export const CATEGORIES: CategoryMeta[] = [
  {
    name: 'Development',
    slug: 'development',
    icon: Code2,
    image: 'https://images.unsplash.com/photo-1565229284535-2cbbe3049123?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Master programming, web development, mobile apps, and software engineering with live expert instruction.',
  },
  {
    name: 'Design',
    slug: 'design',
    icon: Palette,
    image: 'https://images.unsplash.com/photo-1624901344246-8759f305fef3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Learn UI/UX design, graphic design, web design, and creative visual arts from industry professionals.',
  },
  {
    name: 'Marketing',
    slug: 'marketing',
    icon: Megaphone,
    image: 'https://images.unsplash.com/photo-1702047094974-a3475a6e37f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Explore digital marketing, SEO, social media, content strategy, and growth hacking techniques.',
  },
  {
    name: 'Business',
    slug: 'business',
    icon: Briefcase,
    image: 'https://images.unsplash.com/photo-1766867264693-e34f484d3371?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Develop business strategy, entrepreneurship, management, and leadership skills for career growth.',
  },
  {
    name: 'Photography',
    slug: 'photography',
    icon: Camera,
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=1080',
    description: 'Master photography techniques, photo editing, videography, and visual storytelling.',
  },
  {
    name: 'Music',
    slug: 'music',
    icon: Music,
    image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&q=80&w=1080',
    description: 'Learn music production, instrument mastery, music theory, and audio engineering.',
  },
  {
    name: 'Health & Wellness',
    slug: 'health-wellness',
    icon: HeartPulse,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=1080',
    description: 'Discover fitness, nutrition, yoga, meditation, and holistic wellness practices.',
  },
  {
    name: 'Languages',
    slug: 'languages',
    icon: Languages,
    image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=1080',
    description: 'Learn new languages, improve communication skills, and explore world cultures.',
  },
];

export function findCategory(slug?: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}
