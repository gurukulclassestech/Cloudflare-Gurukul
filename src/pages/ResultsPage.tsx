import { useEffect, useMemo, useState } from 'react';
import { Award, ExternalLink, X } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import {
  getResultSectionSubtitle,
  mergePendingResults,
  resolveResultSection,
  sortResultSectionNames,
} from '../data/defaults';
import { subscribePublished } from '../lib/firestoreApi';
import { usePageSeo } from '../lib/seo';
import { CardSkeletonGrid, EmptyState, PageHeroBanner } from '../components/CommonUI';
import { SafeImage } from '../components/SafeImage';
import type { StudentResult } from '../types';

export function ResultsPage() {
  const { site, getPageText } = useSite();
  const pt = getPageText('results');
  usePageSeo('results', pt.title, pt.description);

  const [items, setItems] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [activePoster, setActivePoster] = useState<StudentResult | null>(null);

  useEffect(() => {
    const unsub = subscribePublished<StudentResult>(
      'results',
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

  const displayItems = mergePendingResults(items, site.customized_modules);

  const sections = useMemo(
    () =>
      sortResultSectionNames(
        [...new Set(displayItems.map((r) => resolveResultSection(r)))],
        site.result_section_order
      ),
    [displayItems, site.result_section_order]
  );

  const years = useMemo(
    () => [...new Set(displayItems.map((r) => r.academic_year).filter(Boolean))].sort().reverse(),
    [displayItems]
  );

  const filtered = displayItems.filter((r) => {
    const matchSection = !sectionFilter || resolveResultSection(r) === sectionFilter;
    const matchYear = !yearFilter || r.academic_year === yearFilter;
    return matchSection && matchYear;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, StudentResult[]>();
    for (const res of filtered) {
      const sec = resolveResultSection(res);
      const arr = map.get(sec) || [];
      arr.push(res);
      map.set(sec, arr);
    }
    const orderedNames = sortResultSectionNames([...map.keys()], site.result_section_order);
    return orderedNames.map((sectionTitle) => ({
      title: sectionTitle,
      results: map.get(sectionTitle) || [],
    }));
  }, [filtered, site.result_section_order]);

  return (
    <>
      <PageHeroBanner
        eyebrow={pt.eyebrow}
        title={pt.title}
        description={pt.description}
      />

      <section className="shell py-12 sm:py-16">
        {(sections.length > 0 || years.length > 0) && (
          <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-[hsl(var(--border))] bg-white p-4 sm:p-5">
            {sections.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {pt.extra_label_1 || 'Result section'}
                </span>
                <button
                  type="button"
                  onClick={() => setSectionFilter('')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    sectionFilter === ''
                      ? 'border-[hsl(var(--brand-navy))] bg-[hsl(var(--brand-navy))] text-white'
                      : 'border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground))] hover:border-[hsl(var(--brand-navy))]/40'
                  }`}
                >
                  {pt.extra_label_2 || 'All Sections'}
                </button>
                {sections.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSectionFilter(sec)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      sectionFilter === sec
                        ? 'border-[hsl(var(--brand-navy))] bg-[hsl(var(--brand-navy))] text-white'
                        : 'border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground))] hover:border-[hsl(var(--brand-navy))]/40'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            )}

            {years.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {pt.extra_label_3 || 'Academic year'}
                </span>
                <button
                  type="button"
                  onClick={() => setYearFilter('')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    yearFilter === ''
                      ? 'border-[hsl(var(--brand-navy))] bg-[hsl(var(--brand-navy))] text-white'
                      : 'border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground))] hover:border-[hsl(var(--brand-navy))]/40'
                  }`}
                >
                  All
                </button>
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setYearFilter(year)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition ${
                      yearFilter === year
                        ? 'border-[hsl(var(--brand-navy))] bg-[hsl(var(--brand-navy))] text-white'
                        : 'border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground))] hover:border-[hsl(var(--brand-navy))]/40'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <CardSkeletonGrid count={6} />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={Award}
            title={pt.empty_title || 'No results published yet'}
            description={
              pt.empty_description ||
              "The institute publishes a result only after verification and written consent from the student's family."
            }
          />
        ) : (
          grouped.map((group, idx) => (
            <section key={group.title} className="mt-12 first:mt-0">
              <header className="relative overflow-hidden rounded-2xl border border-[hsl(var(--brand-navy))]/15 border-l-4 border-l-[#FFBE1B] bg-white p-5 shadow-xs sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-navy))] text-base font-bold text-[#FFBE1B] tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="eyebrow">{pt.extra_label_1 || 'Result section'}</p>
                      <h2 className="display-face mt-1 text-2xl leading-tight text-[hsl(var(--brand-navy))] sm:text-[2rem]">
                        {group.title}
                      </h2>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] sm:text-sm">
                        {getResultSectionSubtitle(group.title)}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-lg border border-[hsl(var(--brand-navy))]/12 bg-[hsl(var(--brand-surface))] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-[hsl(var(--brand-navy))] tabular-nums">
                    {group.results.length} {group.results.length === 1 ? 'Result' : 'Results'}
                  </span>
                </div>
              </header>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.results.map((res, resIdx) => (
                  <article
                    key={res.id}
                    className={`surface surface-hover flex flex-col overflow-hidden ${
                      res.is_featured ? 'ring-1 ring-[#FFBE1B]' : ''
                    }`}
                  >
                    {res.photo_url ? (
                      <button
                        type="button"
                        onClick={() => setActivePoster(res)}
                        className="block w-full shrink-0 aspect-square overflow-hidden bg-[hsl(var(--brand-surface))] text-left"
                        aria-label={`View achievement poster for ${res.student_name}`}
                      >
                        <SafeImage
                          src={res.photo_url}
                          alt={res.student_name}
                          fit="contain"
                          variant="card"
                          eager={idx === 0 && resIdx < 3}
                          className="h-full w-full"
                        />
                      </button>
                    ) : null}

                    <div className="flex items-start gap-4 p-5">
                      {!res.photo_url && (
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-navy))] text-lg font-bold text-[#FFBE1B]">
                          {(res.student_name || 'S').trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-base font-bold text-[hsl(var(--brand-navy))]">
                            {res.student_name}
                          </h3>
                          {res.is_featured && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#B45309]">
                              <Award className="h-3 w-3" aria-hidden="true" />
                              <span>Featured</span>
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-snug text-[hsl(var(--muted-foreground))]">
                          {res.achievement_title}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-[hsl(var(--border))] px-5 py-3 text-center tabular-nums">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Score
                        </dt>
                        <dd className="min-w-0 break-words text-sm font-bold text-[hsl(var(--brand-navy))]">
                          {res.score}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Year
                        </dt>
                        <dd className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {res.academic_year || '—'}
                        </dd>
                      </div>
                    </dl>

                    {res.document_url && (
                      <div className="border-t border-[hsl(var(--border))] px-5 py-3">
                        <a
                          href={res.document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--brand-blue))] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>View result document</span>
                        </a>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </section>

      {activePoster && activePoster.photo_url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activePoster.student_name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1D40]/80 p-3 sm:p-4"
          onClick={() => setActivePoster(null)}
        >
          <div
            className="surface relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto p-3 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActivePoster(null)}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#122B5C] shadow"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <SafeImage
              src={activePoster.photo_url}
              alt={activePoster.student_name}
              fit="contain"
              variant="full"
              eager
              className="mx-auto aspect-square max-h-[75dvh] w-full rounded-lg bg-[hsl(var(--brand-surface))]"
            />
            <p className="mt-2.5 px-1 text-sm font-semibold text-[hsl(var(--brand-navy))]">
              {activePoster.student_name} — {activePoster.score} ({activePoster.achievement_title})
            </p>
          </div>
        </div>
      )}
    </>
  );
}
