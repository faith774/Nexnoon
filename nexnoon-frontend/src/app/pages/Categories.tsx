import { useBackendData } from '@/hooks/useBackendData';
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { CATEGORIES as categories } from "@/lib/categories";

export default function Categories() {
  const categoryQuery = useBackendData<{ name: string; count: number }[]>("/data/categories", true);

  const countLabel = (name: string) => {
    if (categoryQuery.isError) return "Unavailable";
    if (categoryQuery.isPending) return "Loading…";
    const count = categoryQuery.data?.find((c) => c.name === name)?.count || 0;
    return `${count} live ${count === 1 ? "class" : "classes"}`;
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <section className="relative overflow-hidden bg-[#14110e] py-20 md:py-28">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[#14110e]/75" />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(ellipse 60% 70% at 50% 40%, rgba(20,17,14,0.2), rgba(20,17,14,0.75)), radial-gradient(ellipse 50% 60% at 100% 0%, rgba(136,157,209,0.28), transparent 60%)',
              }}
            />
          </div>

          <div className="relative mx-auto w-[90vw] text-center">
            <h1 className="mb-4 font-serif text-4xl leading-[1.05] tracking-tight text-white md:text-6xl">
              Explore Live Classes
            </h1>
            <p className="mx-auto max-w-2xl text-base text-white/65 md:text-lg">
              Explore Live Classes to enhance your learning experience.
            </p>
          </div>
        </section>

        <section className="pb-20 pt-12 md:pt-16">
          <div className="mx-auto grid w-[90vw] grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Link
                  key={category.slug}
                  to={`/category/${category.slug}`}
                  className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#889dd1] focus-visible:ring-offset-4"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#ebe6de]">
                    <ImageWithFallback
                      src={category.image}
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#14110e]/30 via-transparent to-transparent" />
                    <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#14110e] shadow-sm backdrop-blur">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="absolute bottom-3 right-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full bg-[#14110e] text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="px-0.5 pt-3">
                    <h3 className="font-serif text-lg leading-snug tracking-tight text-[#14110e] transition-colors group-hover:text-[#5b6fa3]">
                      {category.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#6b655c]">{countLabel(category.name)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
