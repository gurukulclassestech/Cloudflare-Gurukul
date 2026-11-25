import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ListOrdered,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import {
  CLASS_LEVELS,
  DEFAULT_BANNER,
  DEFAULT_BLOGS,
  DEFAULT_COURSE_CATEGORIES,
  DEFAULT_COURSES,
  DEFAULT_EXAMS,
  DEFAULT_RESULT_CATEGORIES,
  DEFAULT_RESULTS,
  DEFAULT_TESTIMONIALS,
  LATEST_UPLOADED_RESULTS,
  NEET_UPLOADED_RESULTS,
  PRIOR_RESULTS_BATCH_SYNC_KEYS,
  RESULTS_BATCH_SYNC_KEY,
  getPendingResultPatch,
  resolveResultSection,
  sortResultSectionNames,
} from '../../data/defaults';
import {
  createDocRecord,
  deleteDocRecord,
  fetchCollection,
  getSingleton,
  logAdminActivity,
  markModuleCustomized,
  sanitizeSiteSettingsPayload,
  setDocRecord,
  setSingleton,
  updateDocRecord,
} from '../../lib/firestoreApi';
import { usePageSeo } from '../../lib/seo';
import { ImageUploaderField } from '../../components/admin/ImageUploaderField';
import { SafeImage } from '../../components/SafeImage';

export type CrudModuleKey =
  | 'banners'
  | 'courses'
  | 'exams'
  | 'lectures'
  | 'results'
  | 'faculty'
  | 'testimonials'
  | 'blogs';

interface FieldSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'image' | 'combobox';
  required?: boolean;
  options?: string[];
  span?: 2;
  placeholder?: string;
}

interface ModuleConfig {
  collection: string;
  title: string;
  subtitle: string;
  primaryField: string;
  secondaryField: string;
  filterKey?: string;
  filterLabel?: string;
  publishField: 'is_published' | 'is_active';
  defaults: Record<string, unknown>;
  fields: FieldSchema[];
}

const MODULE_CONFIGS: Record<CrudModuleKey, ModuleConfig> = {
  banners: {
    collection: 'banners',
    title: 'Homepage Banners',
    subtitle: 'Manage hero slider banners, desktop/mobile photos, and admission deadlines.',
    primaryField: 'title',
    secondaryField: 'subtitle',
    publishField: 'is_active',
    defaults: {
      title: '',
      subtitle: '',
      description: '',
      image_url: '',
      mobile_image_url: '',
      primary_label: 'Apply for admission',
      primary_url: '/admission',
      secondary_label: 'Explore courses',
      secondary_url: '/courses',
      deadline: '',
      display_order: 0,
      is_active: true,
    },
    fields: [
      { key: 'title', label: 'Headline', type: 'text', required: true, span: 2 },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea', span: 2 },
      { key: 'description', label: 'Supporting description', type: 'textarea', span: 2 },
      { key: 'image_url', label: 'Desktop banner image', type: 'image', span: 2 },
      { key: 'mobile_image_url', label: 'Mobile banner image (optional)', type: 'image', span: 2 },
      { key: 'primary_label', label: 'Primary CTA label', type: 'text' },
      { key: 'primary_url', label: 'Primary CTA link', type: 'text' },
      { key: 'secondary_label', label: 'Secondary CTA label', type: 'text' },
      { key: 'secondary_url', label: 'Secondary CTA link', type: 'text' },
      { key: 'deadline', label: 'Admission deadline (optional)', type: 'text', placeholder: '2026-06-30' },
      { key: 'display_order', label: 'Display order', type: 'number' },
      { key: 'is_active', label: 'Active on homepage', type: 'boolean', span: 2 },
    ],
  },
  courses: {
    collection: 'courses',
    title: 'Courses & Programmes',
    subtitle: 'Programmes shown on the Courses page, homepage and admission form. Add, edit, publish, reorder or remove courses.',
    primaryField: 'name',
    secondaryField: 'class_level',
    filterKey: 'category',
    filterLabel: 'All categories',
    publishField: 'is_published',
    defaults: {
      name: '',
      slug: '',
      category: 'IIT-JEE & NEET Two-Year Integrated Programme',
      class_level: 'Class XI & XII',
      duration: '2 Years',
      target_exams: '',
      batch_info: '',
      subjects: '',
      fee: '',
      admission_status: 'open',
      description: '',
      highlights: '',
      eligibility: '',
      methodology: '',
      exam_preparation: '',
      image_url: '',
      display_order: 0,
      is_published: true,
      is_featured: false,
    },
    fields: [
      { key: 'name', label: 'Course name', type: 'text', required: true, span: 2 },
      { key: 'slug', label: 'URL slug (optional, auto-generated)', type: 'text', placeholder: 'two-year-iit-jee-integrated-course' },
      { key: 'admission_status', label: 'Admission status', type: 'select', options: ['open', 'closing_soon', 'closed'] },
      { key: 'category', label: 'Programme category', type: 'combobox', required: true, options: DEFAULT_COURSE_CATEGORIES, placeholder: 'IIT-JEE & NEET Two-Year Integrated Programme' },
      { key: 'class_level', label: 'Starting class / Standard', type: 'combobox', required: true, options: CLASS_LEVELS, placeholder: 'e.g. Class XI & XII, Starts from Class VIII' },
      { key: 'duration', label: 'Duration', type: 'text', placeholder: '2 Years' },
      { key: 'target_exams', label: 'Target examinations', type: 'text', placeholder: 'JEE Main, JEE Advanced, MHT-CET' },
      { key: 'batch_info', label: 'Batch information', type: 'text', placeholder: 'Morning / Evening Batch' },
      { key: 'fee', label: 'Fee note (optional)', type: 'text', placeholder: 'Leave blank if shared by the office' },
      { key: 'subjects', label: 'Subjects covered', type: 'text', span: 2, placeholder: 'Physics, Chemistry, Mathematics' },
      { key: 'display_order', label: 'Display order', type: 'number' },
      { key: 'description', label: 'Short description', type: 'textarea', span: 2 },
      { key: 'highlights', label: 'Course highlights (one per line)', type: 'textarea', span: 2 },
      { key: 'eligibility', label: 'Eligibility criteria (one per line)', type: 'textarea', span: 2 },
      { key: 'exam_preparation', label: 'Examination preparation (one per line)', type: 'textarea', span: 2 },
      { key: 'methodology', label: 'Learning methodology (one per line)', type: 'textarea', span: 2 },
      { key: 'image_url', label: 'Course image', type: 'image', span: 2 },
      { key: 'is_published', label: 'Published on website', type: 'boolean' },
      { key: 'is_featured', label: 'Featured course', type: 'boolean' },
    ],
  },
  exams: {
    collection: 'exams',
    title: 'Examinations & Tests',
    subtitle: 'Publish, reorder, edit, or remove test schedules, durations, syllabus notes, and registration URLs.',
    primaryField: 'title',
    secondaryField: 'exam_date',
    publishField: 'is_published',
    defaults: {
      title: '',
      course_category: 'GPAT',
      class_level: 'Class 10',
      exam_date: '',
      exam_time: '',
      start_time: '',
      duration_minutes: 60,
      syllabus: '',
      instructions: '',
      status: 'open',
      registration_link: '',
      registration_url: '',
      display_order: 0,
      is_published: true,
    },
    fields: [
      { key: 'title', label: 'Exam title', type: 'text', required: true, span: 2 },
      { key: 'class_level', label: 'Class', type: 'select', options: CLASS_LEVELS },
      { key: 'course_category', label: 'Course / Category', type: 'text', placeholder: 'GPAT / Scholarship' },
      { key: 'exam_date', label: 'Exam date', type: 'text', placeholder: '2026-11-21' },
      { key: 'start_time', label: 'Start time (24h e.g. 21:25)', type: 'text', placeholder: '21:25' },
      { key: 'exam_time', label: 'Exam timing note', type: 'text', placeholder: '09:25 PM' },
      { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', required: true, options: ['open', 'upcoming', 'completed', 'closed'] },
      { key: 'display_order', label: 'Display order', type: 'number' },
      { key: 'syllabus', label: 'Syllabus', type: 'textarea', span: 2 },
      { key: 'instructions', label: 'Instructions', type: 'textarea', span: 2 },
      { key: 'registration_url', label: 'Registration URL (optional)', type: 'text', span: 2 },
      { key: 'registration_link', label: 'Registration / Notice fallback link (optional)', type: 'text', span: 2 },
      { key: 'is_published', label: 'Published', type: 'boolean', span: 2 },
    ],
  },
  lectures: {
    collection: 'lectures',
    title: 'Video Lectures',
    subtitle: 'Manage recorded revision lectures with YouTube or video URLs.',
    primaryField: 'title',
    secondaryField: 'subject',
    publishField: 'is_published',
    defaults: {
      title: '',
      subject: '',
      class_level: 'Class 10 (SSC)',
      teacher_name: '',
      duration: '',
      video_url: '',
      thumbnail_url: '',
      description: '',
      display_order: 0,
      is_published: true,
    },
    fields: [
      { key: 'title', label: 'Lecture title', type: 'text', required: true, span: 2 },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'class_level', label: 'Class', type: 'select', required: true, options: CLASS_LEVELS },
      { key: 'teacher_name', label: 'Teacher name', type: 'text' },
      { key: 'duration', label: 'Duration', type: 'text', placeholder: '42 min' },
      { key: 'video_url', label: 'Video / YouTube URL', type: 'text', required: true, span: 2 },
      { key: 'thumbnail_url', label: 'Thumbnail image', type: 'image', span: 2 },
      { key: 'description', label: 'Topic summary', type: 'textarea', span: 2 },
      { key: 'display_order', label: 'Display order', type: 'number' },
      { key: 'is_published', label: 'Published', type: 'boolean' },
    ],
  },
  results: {
    collection: 'results',
    title: 'Results & Achievements',
    subtitle: 'Assign each result to an exam section (JEE Advanced, JEE Main, IIT-JEE, NEET, MHT-CET, etc.) and manage 1254 × 1254 posters.',
    primaryField: 'student_name',
    secondaryField: 'score',
    filterKey: 'category',
    filterLabel: 'All result sections',
    publishField: 'is_published',
    defaults: {
      student_name: '',
      achievement_title: '',
      score: '',
      category: 'JEE Advanced',
      academic_year: '2025-26',
      photo_url: '',
      document_url: '',
      display_order: 0,
      is_featured: false,
      is_published: true,
    },
    fields: [
      { key: 'student_name', label: 'Student name', type: 'text', required: true },
      { key: 'score', label: 'Score / Rank', type: 'text', required: true, placeholder: 'AIR 3 / 97.4%' },
      {
        key: 'category',
        label: 'Result section (upper heading: JEE Advanced, NEET, etc.)',
        type: 'combobox',
        required: true,
        options: DEFAULT_RESULT_CATEGORIES,
        placeholder: 'JEE Advanced, JEE Main, NEET, MHT-CET...',
      },
      { key: 'academic_year', label: 'Academic year (optional)', type: 'text', placeholder: '2025-26' },
      { key: 'achievement_title', label: 'Achievement title', type: 'text', required: true, span: 2 },
      { key: 'photo_url', label: 'Student photo / result poster (1254 × 1254 px, with consent)', type: 'image', span: 2 },
      { key: 'document_url', label: 'Certificate / Document URL (optional)', type: 'text', span: 2 },
      { key: 'display_order', label: 'Display order', type: 'number' },
      { key: 'is_featured', label: 'Featured result', type: 'boolean' },
      { key: 'is_published', label: 'Published', type: 'boolean', span: 2 },
    ],
  },
  faculty: {
    collection: 'faculty',
    title: 'Faculty & Mentors',
    subtitle: 'Manage subject teachers and mentor profiles.',
    primaryField: 'name',
    secondaryField: 'subjects',
    publishField: 'is_published',
    defaults: {
      name: '',
      role: 'Subject Faculty',
      subjects: '',
      qualification: '',
      experience: '',
      bio: '',
      photo_url: '',
      display_order: 0,
      is_published: true,
    },
    fields: [
      { key: 'name', label: 'Teacher name', type: 'text', required: true },
      { key: 'role', label: 'Role / Designation', type: 'text', required: true },
      { key: 'subjects', label: 'Subjects taught', type: 'text', required: true, span: 2 },
      { key: 'qualification', label: 'Qualification', type: 'text' },
      { key: 'experience', label: 'Experience', type: 'text', placeholder: '10+ years' },
      { key: 'bio', label: 'Short bio', type: 'textarea', span: 2 },
      { key: 'photo_url', label: 'Profile photo', type: 'image', span: 2 },
      { key: 'display_order', label: 'Display order', type: 'number' },
      { key: 'is_published', label: 'Published', type: 'boolean' },
    ],
  },
  testimonials: {
    collection: 'testimonials',
    title: 'Student Testimonials',
    subtitle: 'Publish, reorder, edit, or remove student and parent feedback approved for display.',
    primaryField: 'display_name',
    secondaryField: 'role_or_class',
    publishField: 'is_published',
    defaults: {
      display_name: '',
      role_or_class: '',
      quote: '',
      rating: 5,
      photo_url: '',
      display_order: 0,
      is_published: true,
    },
    fields: [
      { key: 'display_name', label: 'Student / Parent name', type: 'text', required: true },
      { key: 'role_or_class', label: 'Class / Batch / Parent', type: 'text' },
      { key: 'quote', label: 'Testimonial quote', type: 'textarea', required: true, span: 2 },
      { key: 'rating', label: 'Rating (1–5)', type: 'number', required: true },
      { key: 'display_order', label: 'Display order', type: 'number' },
      { key: 'photo_url', label: 'Photo (optional)', type: 'image', span: 2 },
      { key: 'is_published', label: 'Published', type: 'boolean', span: 2 },
    ],
  },
  blogs: {
    collection: 'blogs',
    title: 'Blogs & Notices',
    subtitle: 'Publish, toggle, edit, or remove institute notices, exam preparation tips, and newsroom articles.',
    primaryField: 'title',
    secondaryField: 'category',
    publishField: 'is_published',
    defaults: {
      title: '',
      slug: '',
      category: 'Notice',
      author: "Giri Sir's Gurukul Classes",
      published_date: new Date().toISOString().slice(0, 10),
      excerpt: '',
      content: '',
      featured_image_url: '',
      seo_title: '',
      seo_description: '',
      is_published: true,
    },
    fields: [
      { key: 'title', label: 'Article title', type: 'text', required: true, span: 2 },
      { key: 'slug', label: 'URL slug (lowercase letters, numbers, hyphens)', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Notice / Study Guide' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'published_date', label: 'Publish date', type: 'text', placeholder: '2026-11-18' },
      { key: 'excerpt', label: 'Short summary', type: 'textarea', span: 2 },
      { key: 'content', label: 'Article content', type: 'textarea', required: true, span: 2 },
      { key: 'featured_image_url', label: 'Featured image', type: 'image', span: 2 },
      { key: 'seo_title', label: 'SEO title (optional)', type: 'text' },
      { key: 'seo_description', label: 'SEO description (optional)', type: 'text' },
      { key: 'is_published', label: 'Published', type: 'boolean', span: 2 },
    ],
  },
};

function getModuleDefaults(module: CrudModuleKey): Array<Record<string, unknown> & { id: string }> {
  switch (module) {
    case 'banners':
      return [DEFAULT_BANNER as unknown as Record<string, unknown> & { id: string }];
    case 'courses':
      return DEFAULT_COURSES as unknown as Array<Record<string, unknown> & { id: string }>;
    case 'exams':
      return DEFAULT_EXAMS as unknown as Array<Record<string, unknown> & { id: string }>;
    case 'results':
      return DEFAULT_RESULTS as unknown as Array<Record<string, unknown> & { id: string }>;
    case 'testimonials':
      return DEFAULT_TESTIMONIALS as unknown as Array<Record<string, unknown> & { id: string }>;
    case 'blogs':
      return DEFAULT_BLOGS as unknown as Array<Record<string, unknown> & { id: string }>;
    default:
      return [];
  }
}

function SequenceNumberInput({
  value,
  max,
  disabled,
  label,
  onCommit,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  label: string;
  onCommit: (targetPos: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft.trim(), 10);
    if (!Number.isFinite(parsed) || max < 1) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(1, Math.min(max, parsed));
    setDraft(String(clamped));
    if (clamped !== value) {
      onCommit(clamped);
    }
  };

  return (
    <input
      type="number"
      min={1}
      max={Math.max(1, max)}
      disabled={disabled}
      aria-label={label}
      title="Type sequence number (1, 2, 3…) and press Enter"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(String(value));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className="h-8 w-12 shrink-0 rounded-md border border-[hsl(var(--input))] bg-white px-1.5 text-center text-xs font-bold text-[hsl(var(--brand-navy))] tabular-nums outline-none transition focus:border-[hsl(var(--brand-navy))] disabled:opacity-50"
    />
  );
}

export function AdminCrudPage({ module }: { module: CrudModuleKey }) {
  const cfg = MODULE_CONFIGS[module];
  const { site, reloadSite } = useSite();
  usePageSeo('admin', cfg.title);

  const [dbItems, setDbItems] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(cfg.defaults);
  const [saving, setSaving] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [sectionOrderSaving, setSectionOrderSaving] = useState(false);
  const [sectionOrderSaved, setSectionOrderSaved] = useState(false);
  const [showEmptySections, setShowEmptySections] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isCustomized = Boolean(site.customized_modules?.includes(module));
  const defaultRecords = getModuleDefaults(module);
  const hasDefaults = defaultRecords.length > 0;
  const items = isCustomized ? dbItems : dbItems.length > 0 ? dbItems : defaultRecords;
  const supportsOrder = module !== 'blogs';

  const unwrapErr = (err: unknown, fallback: string) => {
    let msg = err instanceof Error ? err.message : fallback;
    try {
      const parsed = JSON.parse(msg) as { error?: string };
      if (parsed?.error) msg = parsed.error;
    } catch {
      // Not a JSON-wrapped error
    }
    return msg;
  };

  const FIELD_MAX_LEN: Record<string, number> = {
    title: 200,
    name: 160,
    slug: 160,
    category: 120,
    course_category: 80,
    class_level: 80,
    duration: 80,
    target_exams: 200,
    batch_info: 160,
    subjects: 300,
    fee: 80,
    description: 4000,
    highlights: 2000,
    eligibility: 1500,
    methodology: 2000,
    exam_preparation: 2000,
    subtitle: 400,
    primary_label: 60,
    primary_url: 200,
    secondary_label: 60,
    secondary_url: 200,
    deadline: 40,
    exam_date: 40,
    exam_time: 60,
    start_time: 40,
    syllabus: 1000,
    instructions: 2000,
    registration_link: 400,
    registration_url: 400,
    subject: 80,
    teacher_name: 100,
    video_url: 500,
    student_name: 120,
    achievement_title: 180,
    score: 60,
    academic_year: 30,
    document_url: 1000,
    role: 100,
    qualification: 160,
    experience: 80,
    bio: 1200,
    display_name: 120,
    role_or_class: 120,
    quote: 1200,
    author: 100,
    published_date: 40,
    excerpt: 400,
    content: 12000,
    seo_title: 160,
    seo_description: 320,
    image_url: 250000,
    mobile_image_url: 250000,
    thumbnail_url: 250000,
    photo_url: 250000,
    featured_image_url: 250000,
  };

  const buildPayloadFromRecord = (rec: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      const v = rec[f.key];
      if (f.type === 'number') payload[f.key] = Number(v) || 0;
      else if (f.type === 'boolean') payload[f.key] = Boolean(v);
      else {
        const maxLen = FIELD_MAX_LEN[f.key] || 1000;
        payload[f.key] = (typeof v === 'string' ? v.trim() : String(v ?? '')).slice(0, maxLen);
      }
    }
    return payload;
  };

  const load = async () => {
    setLoading(true);
    try {
      let rows = await fetchCollection<Record<string, unknown> & { id: string }>(
        cfg.collection,
        [],
        module === 'blogs' ? 'published_date' : 'display_order',
        module === 'blogs' ? 'desc' : 'asc'
      );

      if (module === 'results' && !site.customized_modules?.includes(RESULTS_BATCH_SYNC_KEY)) {
        const hasPriorSync = PRIOR_RESULTS_BATCH_SYNC_KEYS.some((k) =>
          site.customized_modules?.includes(k)
        );
        const existingIds = new Set(rows.map((r) => r.id));
        const existingNames = new Set(
          rows.map((r) => String(r.student_name || '').trim().toLowerCase())
        );
        const maxOrder = rows.reduce(
          (max, r) => Math.max(max, Number(r.display_order || 0)),
          0
        );
        const missingJee = hasPriorSync
          ? []
          : LATEST_UPLOADED_RESULTS.filter(
              (item) =>
                !existingIds.has(item.id) &&
                !existingNames.has(item.student_name.trim().toLowerCase())
            );
        const missingNeet = NEET_UPLOADED_RESULTS.filter(
          (item) =>
            !existingIds.has(item.id) &&
            !existingNames.has(item.student_name.trim().toLowerCase())
        );
        const missing = [...missingJee, ...missingNeet];
        const staleDocs = [...LATEST_UPLOADED_RESULTS, ...NEET_UPLOADED_RESULTS].filter((item) => {
          const match = rows.find((r) => r.id === item.id);
          return (
            match &&
            (match.category !== item.category ||
              (typeof match.photo_url === 'string' && match.photo_url.includes('/assets/aistudio/')))
          );
        });
        const recordPatches = rows
          .map((r) => {
            const patch = getPendingResultPatch({
              id: r.id,
              student_name: String(r.student_name || ''),
              score: String(r.score || ''),
              category: typeof r.category === 'string' ? r.category : '',
              achievement_title: String(r.achievement_title || ''),
              photo_url: typeof r.photo_url === 'string' ? r.photo_url : '',
            });
            return patch ? { id: r.id, patch } : null;
          })
          .filter(
            (x): x is { id: string; patch: Record<string, string> } => x !== null
          );

        if (missing.length > 0 || staleDocs.length > 0 || recordPatches.length > 0) {
          for (let i = 0; i < missing.length; i++) {
            const rec = { ...missing[i], display_order: maxOrder + i + 1 };
            await setDocRecord(
              'results',
              rec.id,
              buildPayloadFromRecord(rec as unknown as Record<string, unknown>)
            );
          }
          for (const rec of staleDocs) {
            await updateDocRecord('results', rec.id, {
              category: rec.category,
              photo_url: rec.photo_url,
            });
          }
          for (const item of recordPatches) {
            await updateDocRecord('results', item.id, item.patch);
          }
          await markModuleCustomized(['results', RESULTS_BATCH_SYNC_KEY]);
          await logAdminActivity(
            'update',
            'results',
            missingNeet.length > 0
              ? 'Synced NEET AIIMS achiever results'
              : recordPatches.length > 0
                ? 'Updated IIT-JEE Reserved labels and result posters'
                : 'Synced JEE Advanced results section'
          );
          rows = await fetchCollection<Record<string, unknown> & { id: string }>(
            cfg.collection,
            [],
            'display_order',
            'asc'
          );
          await reloadSite();
        } else if (rows.length > 0) {
          await markModuleCustomized(['results', RESULTS_BATCH_SYNC_KEY]);
          await reloadSite();
        }
      }

      setDbItems(rows);
    } catch (err) {
      setErrorMsg(unwrapErr(err, 'Could not load records.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearch('');
    setFilterVal('');
    setModalOpen(false);
    setConfirmRestore(false);
    setErrorMsg('');
    load();
  }, [module]);

  const ensureMaterialized = async (): Promise<Array<Record<string, unknown> & { id: string }>> => {
    if (dbItems.length > 0 || isCustomized || !hasDefaults) {
      await markModuleCustomized(module);
      return dbItems;
    }
    for (const rec of defaultRecords) {
      await setDocRecord(cfg.collection, rec.id, buildPayloadFromRecord(rec));
    }
    await markModuleCustomized(module);
    return defaultRecords;
  };

  const restoreDefaults = async () => {
    if (!hasDefaults) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const existing = await fetchCollection<Record<string, unknown> & { id: string }>(cfg.collection);
      const defaultIds = new Set(defaultRecords.map((r) => r.id));
      for (const row of existing) {
        if (!defaultIds.has(row.id)) {
          await deleteDocRecord(cfg.collection, row.id);
        }
      }
      for (const rec of defaultRecords) {
        await setDocRecord(cfg.collection, rec.id, buildPayloadFromRecord(rec));
      }
      await markModuleCustomized(module);
      await logAdminActivity('update', cfg.collection, `Restored default ${cfg.title}`);
      setConfirmRestore(false);
      await load();
      await reloadSite();
    } catch (err) {
      setErrorMsg(unwrapErr(err, `Could not restore default ${cfg.title.toLowerCase()}.`));
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...cfg.defaults, display_order: items.length + 1 });
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEdit = (item: Record<string, unknown> & { id: string }) => {
    setEditingId(item.id);
    setForm({ ...cfg.defaults, ...item });
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      await ensureMaterialized();
      const payload = buildPayloadFromRecord(form);

      if (module === 'blogs') {
        const rawSlug = String(payload.slug || payload.title || '');
        const cleanSlug = rawSlug
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 160);
        payload.slug = cleanSlug.length >= 2 ? cleanSlug : `post-${Date.now()}`;
      }
      if (module === 'courses') {
        const rawSlug = String(payload.slug || payload.name || '');
        const cleanSlug = rawSlug
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 160);
        payload.slug = cleanSlug || `course-${Date.now()}`;
      }
      if (module === 'testimonials') {
        payload.rating = Math.min(5, Math.max(1, Number(payload.rating) || 5));
      }

      if (editingId) {
        await updateDocRecord(cfg.collection, editingId, payload);
        await logAdminActivity(
          'update',
          cfg.collection,
          `Updated ${String(payload[cfg.primaryField] || editingId)}`
        );
      } else {
        await createDocRecord(cfg.collection, payload);
        await logAdminActivity(
          'create',
          cfg.collection,
          `Created ${String(payload[cfg.primaryField] || 'record')}`
        );
      }

      setModalOpen(false);
      await load();
      await reloadSite();
    } catch (err) {
      setErrorMsg(unwrapErr(err, 'Could not save record.'));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (item: Record<string, unknown> & { id: string }) => {
    setErrorMsg('');
    try {
      await ensureMaterialized();
      const nextVal = !Boolean(item[cfg.publishField]);
      await updateDocRecord(cfg.collection, item.id, { [cfg.publishField]: nextVal });
      await logAdminActivity(
        'update',
        cfg.collection,
        `${nextVal ? 'Published' : 'Hid'} ${String(item[cfg.primaryField] || item.id)}`
      );
      await load();
      await reloadSite();
    } catch (err) {
      setErrorMsg(unwrapErr(err, 'Could not update visibility status.'));
    }
  };

  const sectionStats = useMemo(() => {
    const counts = new Map<string, number>();
    if (module !== 'results') return { counts, activeSections: [] as string[], allSections: [] as string[] };
    for (const r of items) {
      const sec = resolveResultSection({
        category: typeof r.category === 'string' ? r.category : '',
        achievement_title: typeof r.achievement_title === 'string' ? r.achievement_title : '',
      });
      counts.set(sec, (counts.get(sec) || 0) + 1);
    }
    const rawPool = Array.from(
      new Set([
        ...(Array.isArray(site.result_section_order) ? site.result_section_order : []),
        ...counts.keys(),
        ...DEFAULT_RESULT_CATEGORIES,
      ])
    ).filter(Boolean);
    const allSections = sortResultSectionNames(rawPool, site.result_section_order);
    const activeSections = allSections.filter((s) => (counts.get(s) || 0) > 0);
    return { counts, activeSections, allSections };
  }, [module, items, site.result_section_order]);

  const displayedSectionList = showEmptySections
    ? sectionStats.allSections
    : sectionStats.activeSections.length > 0
      ? sectionStats.activeSections
      : sectionStats.allSections;

  const persistResultSectionOrder = async (nextVisibleOrder: string[], logText: string) => {
    setErrorMsg('');
    setSectionOrderSaving(true);
    setSectionOrderSaved(false);
    try {
      const visibleSet = new Set(nextVisibleOrder);
      const remaining = sectionStats.allSections.filter((s) => !visibleSet.has(s));
      const fullOrder = [...nextVisibleOrder, ...remaining];
      const existingSettings =
        (await getSingleton<Record<string, unknown>>('site_settings', 'main')) || {};
      const sanitized = sanitizeSiteSettingsPayload(
        { ...existingSettings, result_section_order: fullOrder },
        ['results']
      );
      await setSingleton('site_settings', 'main', sanitized);
      await logAdminActivity('update', 'site_settings', logText);
      await reloadSite();
      setSectionOrderSaved(true);
      setTimeout(() => setSectionOrderSaved(false), 2500);
    } catch (err) {
      setErrorMsg(unwrapErr(err, 'Could not update result section sequence.'));
    } finally {
      setSectionOrderSaving(false);
    }
  };

  const moveResultSection = async (sectionName: string, targetOneBasedPos: number) => {
    const currentList = [...displayedSectionList];
    const idx = currentList.indexOf(sectionName);
    if (idx < 0) return;
    const clampedIdx = Math.max(0, Math.min(currentList.length - 1, targetOneBasedPos - 1));
    if (idx === clampedIdx) return;
    const [moved] = currentList.splice(idx, 1);
    currentList.splice(clampedIdx, 0, moved);
    await persistResultSectionOrder(
      currentList,
      `Moved result section "${sectionName}" to position ${clampedIdx + 1}`
    );
  };

  const resetResultSectionOrder = async () => {
    await persistResultSectionOrder(
      DEFAULT_RESULT_CATEGORIES,
      'Reset result section sequence to default'
    );
  };

  const handleMoveToPosition = async (
    item: Record<string, unknown> & { id: string },
    targetOneBasedPos: number
  ) => {
    if (!supportsOrder) return;
    setErrorMsg('');
    setReorderingId(item.id);
    try {
      const list = [...(await ensureMaterialized())].sort(
        (a, b) =>
          Number(a.display_order || 0) - Number(b.display_order || 0) || a.id.localeCompare(b.id)
      );

      if (cfg.filterKey && filterVal) {
        const key = cfg.filterKey;
        const matchingIndices: number[] = [];
        list.forEach((rec, i) => {
          if (String(rec[key] || '') === filterVal) {
            matchingIndices.push(i);
          }
        });
        const subset = matchingIndices.map((i) => list[i]);
        const subIdx = subset.findIndex((r) => r.id === item.id);
        const targetIdx = Math.max(0, Math.min(subset.length - 1, targetOneBasedPos - 1));
        if (subIdx < 0 || subIdx === targetIdx) return;
        const [moved] = subset.splice(subIdx, 1);
        subset.splice(targetIdx, 0, moved);
        matchingIndices.forEach((origIdx, k) => {
          list[origIdx] = subset[k];
        });
      } else {
        const idx = list.findIndex((r) => r.id === item.id);
        const targetIdx = Math.max(0, Math.min(list.length - 1, targetOneBasedPos - 1));
        if (idx < 0 || idx === targetIdx) return;
        const [moved] = list.splice(idx, 1);
        list.splice(targetIdx, 0, moved);
      }

      const updates = list
        .map((rec, orderIdx) => ({ rec, nextOrder: orderIdx + 1 }))
        .filter(({ rec, nextOrder }) => Number(rec.display_order) !== nextOrder);

      await Promise.all(
        updates.map(({ rec, nextOrder }) =>
          updateDocRecord(cfg.collection, rec.id, { display_order: nextOrder })
        )
      );

      await logAdminActivity(
        'update',
        cfg.collection,
        `Set sequence for ${String(item[cfg.primaryField] || item.id)} to #${targetOneBasedPos}`
      );
      await load();
      await reloadSite();
    } catch (err) {
      setErrorMsg(unwrapErr(err, 'Could not update sequence.'));
    } finally {
      setReorderingId(null);
    }
  };

  const handleMove = async (item: Record<string, unknown> & { id: string }, dir: -1 | 1) => {
    const currentIdx = filtered.findIndex((r) => r.id === item.id);
    if (currentIdx < 0) return;
    await handleMoveToPosition(item, currentIdx + 1 + dir);
  };

  const handleDelete = async (item: Record<string, unknown> & { id: string }) => {
    setErrorMsg('');
    try {
      await ensureMaterialized();
      await deleteDocRecord(cfg.collection, item.id);
      await logAdminActivity(
        'delete',
        cfg.collection,
        `Deleted ${String(item[cfg.primaryField] || item.id)}`
      );
      await load();
      await reloadSite();
    } catch (err) {
      setErrorMsg(unwrapErr(err, 'Could not delete record.'));
    }
  };

  const rawFilterOptions = cfg.filterKey
    ? [...new Set(items.map((item) => String(item[cfg.filterKey!] || '')).filter(Boolean))]
    : [];
  const filterOptions =
    module === 'results'
      ? sortResultSectionNames(rawFilterOptions, site.result_section_order)
      : rawFilterOptions;

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchText =
      !q ||
      [
        item[cfg.primaryField],
        item[cfg.secondaryField],
        cfg.filterKey ? item[cfg.filterKey] : '',
        item.subjects,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    const matchFilter =
      !cfg.filterKey || !filterVal || String(item[cfg.filterKey] || '') === filterVal;
    return matchText && matchFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--brand-navy))] sm:text-2xl">
            {cfg.title}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{cfg.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasDefaults && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmRestore(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-white px-3.5 py-2 text-xs font-semibold text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-surface))]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Restore defaults</span>
            </button>
          )}
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--brand-navy))] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add new</span>
          </button>
        </div>
      </div>

      {module === 'results' && !loading && displayedSectionList.length > 0 && (
        <section className="surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand-navy))] text-[#FFBE1B]">
                <ListOrdered className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[hsl(var(--brand-navy))]">
                  Result Sections Sequence (01, 02, 03…)
                </h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Change the display sequence (1, 2, 3…) or use arrows to control which heading appears first on the Results page and homepage.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {sectionOrderSaving && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--brand-navy))]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Saving…</span>
                </span>
              )}
              {sectionOrderSaved && !sectionOrderSaving && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Saved</span>
                </span>
              )}
              {sectionStats.allSections.length > sectionStats.activeSections.length && (
                <button
                  type="button"
                  onClick={() => setShowEmptySections((v) => !v)}
                  className="rounded-lg border border-[hsl(var(--border))] bg-white px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-surface))]"
                >
                  {showEmptySections ? 'Active sections only' : 'Show all categories'}
                </button>
              )}
              <button
                type="button"
                disabled={sectionOrderSaving}
                onClick={resetResultSectionOrder}
                className="rounded-lg border border-[hsl(var(--border))] bg-white px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--brand-navy))] disabled:opacity-50"
              >
                Reset default
              </button>
            </div>
          </div>

          <div className="mt-4 divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--brand-surface))]/40">
            {displayedSectionList.map((secName, sIdx) => {
              const count = sectionStats.counts.get(secName) || 0;
              return (
                <div
                  key={secName}
                  className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[hsl(var(--brand-navy))] text-xs font-bold text-[#FFBE1B] tabular-nums">
                      {String(sIdx + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate text-sm font-bold text-[hsl(var(--brand-navy))]">
                      {secName}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                        count > 0
                          ? 'bg-white text-[hsl(var(--brand-navy))] border border-[hsl(var(--border))]'
                          : 'text-[hsl(var(--muted-foreground))]'
                      }`}
                    >
                      {count} {count === 1 ? 'result' : 'results'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                      Seq
                    </label>
                    <SequenceNumberInput
                      value={sIdx + 1}
                      max={displayedSectionList.length}
                      disabled={sectionOrderSaving}
                      label={`Sequence for ${secName}`}
                      onCommit={(targetPos) => moveResultSection(secName, targetPos)}
                    />
                    <button
                      type="button"
                      disabled={sectionOrderSaving || sIdx === 0}
                      onClick={() => moveResultSection(secName, sIdx)}
                      aria-label={`Move section ${secName} up`}
                      className="rounded p-1.5 text-slate-500 transition hover:bg-white hover:text-[hsl(var(--brand-navy))] disabled:opacity-25"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={sectionOrderSaving || sIdx === displayedSectionList.length - 1}
                      onClick={() => moveResultSection(secName, sIdx + 2)}
                      aria-label={`Move section ${secName} down`}
                      className="rounded p-1.5 text-slate-500 transition hover:bg-white hover:text-[hsl(var(--brand-navy))] disabled:opacity-25"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="surface flex flex-wrap items-center gap-3 p-3">
        <div className="relative w-full min-w-0 flex-1 sm:min-w-[220px] sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
            aria-hidden="true"
          />
          <input
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[hsl(var(--brand-navy))]"
            placeholder={`Search ${cfg.title.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {cfg.filterKey && filterOptions.length > 0 && (
          <select
            value={filterVal}
            onChange={(e) => setFilterVal(e.target.value)}
            aria-label={cfg.filterLabel || 'Filter records'}
            className="rounded-lg border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm outline-none focus:border-[hsl(var(--brand-navy))]"
          >
            <option value="">{cfg.filterLabel || 'All'}</option>
            {filterOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
      </div>

      {errorMsg && !modalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="surface overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[hsl(var(--brand-navy))]">No records yet</p>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {hasDefaults
                ? 'Click “Add new” to create a record or “Restore defaults” to bring back standard entries.'
                : 'Click “Add new” above to publish your first entry.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {filtered.map((item, idx) => {
              const isLive = Boolean(item[cfg.publishField]);
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {supportsOrder && search.trim() === '' ? (
                      <SequenceNumberInput
                        value={idx + 1}
                        max={filtered.length}
                        disabled={Boolean(reorderingId)}
                        label={`Sequence number for ${String(item[cfg.primaryField] || item.id)}`}
                        onCommit={(targetPos) => handleMoveToPosition(item, targetPos)}
                      />
                    ) : (
                      <span className="w-5 shrink-0 text-right text-xs font-semibold text-slate-400 tabular-nums">
                        {idx + 1}
                      </span>
                    )}
                    {module === 'courses' && (
                      <div className="hidden h-11 w-20 shrink-0 overflow-hidden rounded-md border border-[hsl(var(--border))] sm:block">
                        <SafeImage
                          src={String(item.image_url || '/assets/gurukul/course_two-year-iit-jee-integrated-course.png')}
                          alt={String(item[cfg.primaryField] || 'Course')}
                          variant="card"
                          className="h-full w-full"
                        />
                      </div>
                    )}
                    {module === 'results' && Boolean(item.photo_url) && (
                      <div className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--brand-surface))] sm:block">
                        <SafeImage
                          src={String(item.photo_url)}
                          alt={String(item[cfg.primaryField] || 'Result')}
                          fit="contain"
                          variant="card"
                          className="h-full w-full"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`truncate text-sm font-bold ${
                            isLive ? 'text-[hsl(var(--brand-navy))]' : 'text-slate-400'
                          }`}
                        >
                          {String(item[cfg.primaryField] || 'Untitled')}
                        </p>
                        {module === 'results' && Boolean(item.category) && (
                          <span className="rounded-full border border-[hsl(var(--brand-navy))]/15 bg-[hsl(var(--brand-surface))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--brand-navy))]">
                            {String(item.category)}
                          </span>
                        )}
                        {module === 'courses' && Boolean(item.is_featured) && (
                          <span className="rounded-full bg-[#FFBE1B]/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8A5A00]">
                            Featured
                          </span>
                        )}
                        {module === 'courses' && Boolean(item.admission_status) && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              item.admission_status === 'closed'
                                ? 'border-slate-200 bg-slate-100 text-slate-600'
                                : item.admission_status === 'closing_soon'
                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {item.admission_status === 'closing_soon'
                              ? 'Closing soon'
                              : item.admission_status === 'closed'
                                ? 'Closed'
                                : 'Open'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {(module === 'courses' || module === 'results') && item.category
                          ? `${String(item.category)} · `
                          : ''}
                        {String(item[cfg.secondaryField] || '')}
                        {module === 'courses' && item.duration ? ` · ${String(item.duration)}` : ''}
                        {item[cfg.secondaryField] ? ' · ' : ''}
                        <span className={isLive ? 'font-semibold text-emerald-700' : 'text-slate-500'}>
                          {isLive ? 'Published' : 'Hidden'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap shrink-0 items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isLive}
                      aria-label={`${isLive ? 'Hide' : 'Publish'} ${String(item[cfg.primaryField] || item.id)}`}
                      onClick={() => handleTogglePublish(item)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        isLive ? 'bg-[hsl(var(--brand-navy))]' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          isLive ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    {supportsOrder && search.trim() === '' && (
                      <>
                        <button
                          type="button"
                          disabled={idx === 0 || Boolean(reorderingId)}
                          onClick={() => handleMove(item, -1)}
                          aria-label={`Move ${String(item[cfg.primaryField] || item.id)} up`}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[hsl(var(--brand-navy))] disabled:opacity-25"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === filtered.length - 1 || Boolean(reorderingId)}
                          onClick={() => handleMove(item, 1)}
                          aria-label={`Move ${String(item[cfg.primaryField] || item.id)} down`}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[hsl(var(--brand-navy))] disabled:opacity-25"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      aria-label={`Edit ${String(item[cfg.primaryField] || item.id)}`}
                      className="rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[hsl(var(--brand-navy))]"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      aria-label={`Delete ${String(item[cfg.primaryField] || item.id)}`}
                      className="rounded p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmRestore && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1D40]/60 p-4"
        >
          <div className="surface w-full max-w-md space-y-4 p-6">
            <h2 className="text-base font-bold text-[hsl(var(--brand-navy))]">
              Restore default {cfg.title.toLowerCase()}?
            </h2>
            <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
              This will restore the built-in {cfg.title.toLowerCase()} entries and remove any custom
              additions in this module.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestore(false)}
                className="rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={restoreDefaults}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--brand-navy))] px-4 py-2 text-xs font-semibold text-white"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Restore defaults</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1D40]/60 p-3 sm:p-4"
        >
          <form
            onSubmit={handleSave}
            className="surface max-h-[90dvh] w-full max-w-2xl space-y-4 overflow-y-auto p-4 sm:p-6"
          >
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
              <h2 className="text-base font-bold text-[hsl(var(--brand-navy))]">
                {editingId ? 'Edit' : 'New'} {cfg.title}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {cfg.fields.map((field) => {
                const spanCls = field.span === 2 ? 'sm:col-span-2' : '';
                if (field.type === 'image') {
                  return (
                    <div key={field.key} className={spanCls}>
                      <ImageUploaderField
                        id={`f-${field.key}`}
                        label={field.label}
                        value={String(form[field.key] || '')}
                        onChange={(url) => setForm((prev) => ({ ...prev, [field.key]: url }))}
                        folder={cfg.collection}
                      />
                    </div>
                  );
                }
                if (field.type === 'boolean') {
                  return (
                    <label
                      key={field.key}
                      className={`flex items-center gap-2 text-xs font-semibold text-[hsl(var(--brand-navy))] ${spanCls}`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(form[field.key])}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, [field.key]: e.target.checked }))
                        }
                        className="h-4 w-4 rounded"
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }
                if (field.type === 'combobox') {
                  const listId = `datalist-${field.key}`;
                  const combinedOptions = [
                    ...new Set([
                      ...(field.options || []),
                      ...items.map((r) => String(r[field.key] || '')).filter(Boolean),
                    ]),
                  ];
                  return (
                    <div key={field.key} className={spanCls}>
                      <label htmlFor={`f-${field.key}`} className="mb-1 block text-xs font-semibold">
                        {field.label}
                      </label>
                      <input
                        id={`f-${field.key}`}
                        list={listId}
                        required={field.required}
                        value={String(form[field.key] ?? '')}
                        placeholder={field.placeholder}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm"
                      />
                      <datalist id={listId}>
                        {combinedOptions.map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    </div>
                  );
                }
                if (field.type === 'select') {
                  const currentVal = String(form[field.key] || '');
                  const opts =
                    currentVal && !field.options?.includes(currentVal)
                      ? [currentVal, ...(field.options || [])]
                      : field.options || [];
                  return (
                    <div key={field.key} className={spanCls}>
                      <label htmlFor={`f-${field.key}`} className="mb-1 block text-xs font-semibold">
                        {field.label}
                      </label>
                      <select
                        id={`f-${field.key}`}
                        value={currentVal}
                        required={field.required}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm"
                      >
                        {opts.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (field.type === 'textarea') {
                  return (
                    <div key={field.key} className={spanCls}>
                      <label htmlFor={`f-${field.key}`} className="mb-1 block text-xs font-semibold">
                        {field.label}
                      </label>
                      <textarea
                        id={`f-${field.key}`}
                        rows={3}
                        required={field.required}
                        value={String(form[field.key] || '')}
                        placeholder={field.placeholder}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  );
                }
                return (
                  <div key={field.key} className={spanCls}>
                    <label htmlFor={`f-${field.key}`} className="mb-1 block text-xs font-semibold">
                      {field.label}
                    </label>
                    <input
                      id={`f-${field.key}`}
                      type={field.type === 'number' ? 'number' : 'text'}
                      required={field.required}
                      value={String(form[field.key] ?? '')}
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                );
              })}
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[hsl(var(--border))] pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--brand-navy))] px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                <span>Save</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
