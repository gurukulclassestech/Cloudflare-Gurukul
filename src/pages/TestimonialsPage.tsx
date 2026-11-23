import { useEffect, useState } from 'react';
import { MessageSquareQuote } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { DEFAULT_TESTIMONIALS } from '../data/defaults';
import { subscribePublished } from '../lib/firestoreApi';
import { usePageSeo } from '../lib/seo';
import {
  CardSkeletonGrid,
  EmptyState,
  PageHeroBanner,
  TestimonialCard,
} from '../components/CommonUI';
import type { Testimonial } from '../types';

export function TestimonialsPage() {
  const { site, getPageText } = useSite();
  const pt = getPageText('testimonials');
  usePageSeo('testimonials', pt.title, pt.description);

  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribePublished<Testimonial>(
      'testimonials',
      (rows) => {
        setItems(rows);
        setLoading(false);
      },
      'display_order',
      'asc',
      100,
      () => {
        setItems([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const isCustomized = site.customized_modules?.includes('testimonials');
  const displayItems = isCustomized ? items : items.length > 0 ? items : DEFAULT_TESTIMONIALS;

  return (
    <>
      <PageHeroBanner
        eyebrow={pt.eyebrow}
        title={pt.title}
        description={pt.description}
      />

      <section className="shell py-12 sm:py-16">
        {loading ? (
          <CardSkeletonGrid count={6} />
        ) : displayItems.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={pt.empty_title || 'No testimonials published yet'}
            description={
              pt.empty_description ||
              'Approved student feedback will appear here. The institute publishes a testimonial only with permission.'
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {displayItems.map((t) => (
              <TestimonialCard key={t.id} testimonial={t} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
