import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { subscribePublished } from '../lib/firestoreApi';
import { usePageSeo } from '../lib/seo';
import {
  CardSkeletonGrid,
  EmptyState,
  FacultyCard,
  PageHeroBanner,
} from '../components/CommonUI';
import type { FacultyMember } from '../types';

export function FacultyPage() {
  const { getPageText } = useSite();
  const pt = getPageText('faculty');
  usePageSeo('faculty', pt.title, pt.description);

  const [items, setItems] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribePublished<FacultyMember>(
      'faculty',
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

  return (
    <>
      <PageHeroBanner
        eyebrow={pt.eyebrow}
        title={pt.title}
        description={pt.description}
      />

      <section className="shell py-12 sm:py-16">
        {loading ? (
          <CardSkeletonGrid count={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={pt.empty_title || 'Faculty profiles are being added'}
            description={
              pt.empty_description || 'Teaching profiles appear here once the institute publishes them.'
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((member) => (
              <FacultyCard key={member.id} member={member} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
