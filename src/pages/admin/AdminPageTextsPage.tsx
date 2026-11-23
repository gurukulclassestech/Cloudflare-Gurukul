import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { DEFAULT_PAGE_TEXTS } from '../../data/defaults';
import {
  deleteDocRecord,
  fetchCollection,
  logAdminActivity,
  sanitizePageTextPayload,
  setDocRecord,
} from '../../lib/firestoreApi';
import { usePageSeo } from '../../lib/seo';
import type { PageText, PageTextKey } from '../../types';

const INPUT_CLASS =
  'w-full rounded-lg border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--brand-navy))] focus:ring-2 focus:ring-[hsl(var(--brand-navy))]/15';

interface FieldDescriptor {
  key: keyof Omit<PageText, 'id'>;
  label: string;
  multiline?: boolean;
  maxLen: number;
  required?: boolean;
  hint?: string;
}

interface PageConfigSpec {
  key: PageTextKey;
  label: string;
  route: string;
  summary: string;
  fields: FieldDescriptor[];
}

const PAGE_SPECS: PageConfigSpec[] = [
  {
    key: 'results',
    label: 'Results Page',
    route: '/results',
    summary: 'Hero banner, section filter labels, and empty state on /results.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'extra_label_1', label: 'Section filter & header eyebrow label', maxLen: 200 },
      { key: 'extra_label_2', label: '"All Sections" button text', maxLen: 200 },
      { key: 'extra_label_3', label: 'Academic year filter label', maxLen: 200 },
      { key: 'empty_title', label: 'Empty state heading', maxLen: 200 },
      { key: 'empty_description', label: 'Empty state description', multiline: true, maxLen: 600 },
    ],
  },
  {
    key: 'exams',
    label: 'Exams Page',
    route: '/exams',
    summary: 'Hero banner and empty filter state on /exams.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'empty_title', label: 'No matches heading', maxLen: 200 },
      { key: 'empty_description', label: 'No matches description', multiline: true, maxLen: 600 },
    ],
  },
  {
    key: 'lectures',
    label: 'Lectures Page',
    route: '/lectures',
    summary: 'Hero banner, watch label, and empty state on /lectures.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'extra_label_1', label: 'Card action label (e.g. Watch lecture)', maxLen: 200 },
      { key: 'empty_title', label: 'Empty state heading', maxLen: 200 },
      { key: 'empty_description', label: 'Empty state description', multiline: true, maxLen: 600 },
    ],
  },
  {
    key: 'faculty',
    label: 'Faculty Page',
    route: '/faculty',
    summary: 'Hero banner and empty state on /faculty.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'empty_title', label: 'Empty state heading', maxLen: 200 },
      { key: 'empty_description', label: 'Empty state description', multiline: true, maxLen: 600 },
    ],
  },
  {
    key: 'testimonials',
    label: 'Testimonials Page',
    route: '/testimonials',
    summary: 'Hero banner and empty state on /testimonials.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'empty_title', label: 'Empty state heading', maxLen: 200 },
      { key: 'empty_description', label: 'Empty state description', multiline: true, maxLen: 600 },
    ],
  },
  {
    key: 'gallery',
    label: 'Gallery Page',
    route: '/gallery',
    summary: 'Hero banner, album filter label, and empty state on /gallery.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'extra_label_1', label: '"All albums" button text', maxLen: 200 },
      { key: 'empty_title', label: 'Empty album heading', maxLen: 200 },
      { key: 'empty_description', label: 'Empty album description', multiline: true, maxLen: 600 },
    ],
  },
  {
    key: 'blogs',
    label: 'Blogs / Newsroom Page',
    route: '/blogs',
    summary: 'Hero banner and empty search state on /blogs.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'empty_title', label: 'No matches heading', maxLen: 200 },
      { key: 'empty_description', label: 'No matches description', multiline: true, maxLen: 600 },
    ],
  },
  {
    key: 'contact',
    label: 'Contact Page',
    route: '/contact',
    summary: 'Hero banner, enquiry form card heading/button, and WhatsApp/Map button labels.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'secondary_title', label: 'Enquiry form heading', maxLen: 220 },
      { key: 'secondary_description', label: 'Enquiry form helper text', maxLen: 1000 },
      { key: 'cta_label', label: 'Enquiry submit button text', maxLen: 80 },
      { key: 'extra_label_1', label: 'WhatsApp button label', maxLen: 200 },
      { key: 'extra_label_2', label: 'Google Maps button label', maxLen: 200 },
    ],
  },
  {
    key: 'admission',
    label: 'Admission Page',
    route: '/admission',
    summary: 'Hero banner, application form heading/submit label, and sidebar headings on /admission.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow', maxLen: 120 },
      { key: 'title', label: 'Main page heading', maxLen: 220, required: true },
      { key: 'description', label: 'Hero subtitle / description', multiline: true, maxLen: 1000 },
      { key: 'secondary_title', label: 'Form card heading', maxLen: 220 },
      { key: 'secondary_description', label: 'Form card helper note', maxLen: 1000 },
      { key: 'cta_label', label: 'Application submit button text', maxLen: 80 },
      { key: 'extra_label_1', label: 'Sidebar steps heading (How admission works)', maxLen: 200 },
      { key: 'extra_label_2', label: 'Address box heading', maxLen: 200 },
    ],
  },
  {
    key: 'about',
    label: 'About Page Labels',
    route: '/about',
    summary: 'Section eyebrows, dark mission motto line, and bottom CTA labels on /about.',
    fields: [
      { key: 'eyebrow', label: 'Hero eyebrow (About us)', maxLen: 120 },
      { key: 'title', label: 'Story section eyebrow', maxLen: 220, required: true },
      { key: 'description', label: 'Sidebar badge eyebrow', maxLen: 1000 },
      { key: 'extra_label_1', label: 'Dark navy band motto eyebrow', maxLen: 200 },
      { key: 'secondary_eyebrow', label: 'Features block eyebrow (How we teach)', maxLen: 120 },
      { key: 'extra_label_2', label: 'Bottom CTA eyebrow (Visit the institute)', maxLen: 200 },
      { key: 'secondary_title', label: 'Bottom CTA heading', maxLen: 220 },
      { key: 'cta_label', label: 'Primary button label (Apply for admission)', maxLen: 80 },
      { key: 'extra_label_3', label: 'Secondary button label (View courses)', maxLen: 200 },
    ],
  },
  {
    key: 'footer',
    label: 'Footer Column Labels',
    route: '/',
    summary: 'Column headings and legal link labels in the global website footer.',
    fields: [
      { key: 'title', label: 'Links column heading (Quick links)', maxLen: 220, required: true },
      { key: 'description', label: 'Courses column heading (Courses)', maxLen: 1000 },
      { key: 'secondary_title', label: 'Contact column heading (Contact)', maxLen: 220 },
      { key: 'secondary_description', label: 'Privacy Policy link label', maxLen: 1000 },
      { key: 'extra_label_1', label: 'Terms & Conditions link label', maxLen: 200 },
      { key: 'extra_label_2', label: 'Admin Console link label', maxLen: 200 },
    ],
  },
  {
    key: 'course_detail',
    label: 'Course Detail Page',
    route: '/courses',
    summary: 'Sidebar enquiry card and headings shown inside individual course pages.',
    fields: [
      { key: 'eyebrow', label: 'Sidebar enquiry card eyebrow', maxLen: 120 },
      { key: 'title', label: 'Programme overview heading', maxLen: 220, required: true },
      { key: 'description', label: 'Sidebar enquiry helper text', multiline: true, maxLen: 1000 },
      { key: 'secondary_eyebrow', label: 'Admission prompt eyebrow', maxLen: 120 },
      { key: 'secondary_title', label: 'Admission prompt title', maxLen: 220 },
      { key: 'cta_label', label: 'Enquiry submit button label', maxLen: 80 },
      { key: 'extra_label_1', label: 'Back button label (All courses)', maxLen: 200 },
    ],
  },
  {
    key: 'blog_detail',
    label: 'Article Detail Page',
    route: '/blogs',
    summary: 'Navigation and bottom admission callout inside individual blog posts.',
    fields: [
      { key: 'title', label: 'Bottom callout heading', maxLen: 220, required: true },
      { key: 'description', label: 'Bottom callout text', multiline: true, maxLen: 1000 },
      { key: 'cta_label', label: 'Primary button label', maxLen: 80 },
      { key: 'extra_label_1', label: 'Back link label (All articles)', maxLen: 200 },
      { key: 'extra_label_2', label: 'Secondary button label (Contact us)', maxLen: 200 },
    ],
  },
];

function unwrapError(err: unknown, fallback: string): string {
  let msg = err instanceof Error ? err.message : fallback;
  try {
    const parsed = JSON.parse(msg) as { error?: string };
    if (parsed?.error) msg = parsed.error;
  } catch {
    // Plain message
  }
  return msg;
}

export function AdminPageTextsPage() {
  usePageSeo('admin', 'Page Texts & Labels');
  const { getPageText, reloadSite } = useSite();

  const [selectedKey, setSelectedKey] = useState<PageTextKey>('results');
  const [search, setSearch] = useState('');
  const [customizedKeys, setCustomizedKeys] = useState<Set<PageTextKey>>(new Set());
  const [form, setForm] = useState<PageText>(() => ({ ...DEFAULT_PAGE_TEXTS.results }));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const refreshCustomizedKeys = () => {
    fetchCollection<PageText>('page_texts')
      .then((rows) => {
        setCustomizedKeys(new Set(rows.map((r) => r.id)));
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshCustomizedKeys();
  }, []);

  useEffect(() => {
    const current = getPageText(selectedKey);
    setForm({ ...DEFAULT_PAGE_TEXTS[selectedKey], ...current, id: selectedKey });
    setSavedMsg('');
    setErrorMsg('');
  }, [selectedKey, getPageText]);

  const activeSpec = PAGE_SPECS.find((p) => p.key === selectedKey) || PAGE_SPECS[0];

  const filteredSpecs = PAGE_SPECS.filter((spec) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      spec.label.toLowerCase().includes(q) ||
      spec.summary.toLowerCase().includes(q) ||
      spec.route.toLowerCase().includes(q)
    );
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    setErrorMsg('');
    try {
      const payload = sanitizePageTextPayload(selectedKey, form);
      await setDocRecord('page_texts', selectedKey, payload);
      await logAdminActivity('update', 'page_texts', `Updated text on ${activeSpec.label}`);
      refreshCustomizedKeys();
      await reloadSite();
      setSavedMsg(`${activeSpec.label} text updated and live on website.`);
    } catch (err) {
      setErrorMsg(unwrapError(err, 'Could not save page text.'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPage = async () => {
    setSaving(true);
    setSavedMsg('');
    setErrorMsg('');
    try {
      await deleteDocRecord('page_texts', selectedKey).catch(() => {});
      setForm({ ...DEFAULT_PAGE_TEXTS[selectedKey] });
      await logAdminActivity('update', 'page_texts', `Restored default text on ${activeSpec.label}`);
      refreshCustomizedKeys();
      await reloadSite();
      setSavedMsg(`${activeSpec.label} restored to default wording.`);
    } catch (err) {
      setErrorMsg(unwrapError(err, 'Could not restore default wording.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--brand-navy))] sm:text-2xl">
            Page Texts &amp; Labels
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Edit any hero heading, subtitle, filter label, button text, or empty-state message across your public pages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            to="/admin/homepage"
            className="rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-1.5 font-semibold text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-surface))]"
          >
            Homepage Sections
          </Link>
          <Link
            to="/admin/about"
            className="rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-1.5 font-semibold text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-surface))]"
          >
            About Story
          </Link>
          <Link
            to="/admin/courses-page"
            className="rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-1.5 font-semibold text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-surface))]"
          >
            Courses Page Copy
          </Link>
          <Link
            to="/admin/settings"
            className="rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-1.5 font-semibold text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-surface))]"
          >
            Header &amp; Announcements
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
        <aside className="surface space-y-3 p-3.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              className={`${INPUT_CLASS} pl-8 text-xs`}
              placeholder="Find page (e.g. results, footer)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter pages"
            />
          </div>

          <div className="space-y-1">
            {filteredSpecs.map((spec) => {
              const active = spec.key === selectedKey;
              const isEdited = customizedKeys.has(spec.key);
              return (
                <button
                  key={spec.key}
                  type="button"
                  onClick={() => setSelectedKey(spec.key)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition ${
                    active
                      ? 'bg-[hsl(var(--brand-navy))] text-white'
                      : 'text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-surface))]'
                  }`}
                >
                  <span className="truncate">{spec.label}</span>
                  {isEdited && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        active ? 'bg-[#FFBE1B] text-[#122B5C]' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      Edited
                    </span>
                  )}
                </button>
              );
            })}
            {filteredSpecs.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
                No page matches “{search}”.
              </p>
            )}
          </div>
        </aside>

        <form onSubmit={handleSave} className="surface space-y-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[hsl(var(--border))] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FFBE1B]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[hsl(var(--brand-navy))]">
                  {activeSpec.label}
                </h2>
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {activeSpec.summary}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={activeSpec.route}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-surface))]"
              >
                <span>Open page</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
              <button
                type="button"
                disabled={saving}
                onClick={handleResetPage}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Restore default</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {activeSpec.fields.map((field) => {
              const value = String(form[field.key] ?? '');
              const inputId = `pt-${activeSpec.key}-${field.key}`;
              return (
                <div key={field.key}>
                  <label htmlFor={inputId} className="mb-1 block text-xs font-semibold">
                    {field.label}
                    {field.required && <span className="ml-0.5 text-red-600">*</span>}
                  </label>
                  {field.multiline ? (
                    <textarea
                      id={inputId}
                      rows={3}
                      maxLength={field.maxLen}
                      required={field.required}
                      className={INPUT_CLASS}
                      value={value}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, [field.key]: e.target.value }));
                        setSavedMsg('');
                      }}
                    />
                  ) : (
                    <input
                      id={inputId}
                      maxLength={field.maxLen}
                      required={field.required}
                      className={INPUT_CLASS}
                      value={value}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, [field.key]: e.target.value }));
                        setSavedMsg('');
                      }}
                    />
                  )}
                  {field.hint && (
                    <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                      {field.hint}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          {savedMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{savedMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-[hsl(var(--border))] pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFBE1B] px-5 py-2.5 text-xs font-bold text-[#122B5C] transition hover:bg-[#f2b211] disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              <span>{saving ? 'Saving…' : 'Save page text'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
