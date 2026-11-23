import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { DEFAULT_COURSE_CATEGORY_DESCRIPTIONS, DEFAULT_SITE_SETTINGS } from '../data/defaults';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

const SYNC_CHANNEL_NAME = 'gurukul_cms_sync';
const SYNC_STORAGE_KEY = 'gurukul_cms_sync_ts';
const SYNC_DOM_EVENT = 'gurukul:content-updated';

export function notifyContentUpdated(sourceCollection = 'all'): void {
  if (typeof window === 'undefined') return;
  const payload = { source: sourceCollection, ts: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent(SYNC_DOM_EVENT, { detail: payload }));
  } catch {
    // Ignore event dispatch errors
  }
  try {
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
  try {
    window.localStorage.setItem(SYNC_STORAGE_KEY, `${payload.ts}:${sourceCollection}`);
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function onContentUpdated(handler: (sourceCollection: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onDom = (e: Event) => {
    const detail = (e as CustomEvent<{ source?: string }>).detail;
    handler(detail?.source || 'all');
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === SYNC_STORAGE_KEY && e.newValue) {
      const idx = e.newValue.indexOf(':');
      handler(idx >= 0 ? e.newValue.slice(idx + 1) : 'all');
    }
  };
  let ch: BroadcastChannel | null = null;
  const onChannel = (e: MessageEvent<{ source?: string }>) => {
    handler(e.data?.source || 'all');
  };
  window.addEventListener(SYNC_DOM_EVENT, onDom);
  window.addEventListener('storage', onStorage);
  try {
    if ('BroadcastChannel' in window) {
      ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.addEventListener('message', onChannel);
    }
  } catch {
    ch = null;
  }
  return () => {
    window.removeEventListener(SYNC_DOM_EVENT, onDom);
    window.removeEventListener('storage', onStorage);
    if (ch) {
      ch.removeEventListener('message', onChannel);
      ch.close();
    }
  };
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'item';
}

/**
 * Produces a strictly allowlisted `site_settings` payload matching `isValidSiteSettings`
 * in `firestore.rules`, stripping any legacy/unknown keys (like `id`) and enforcing bounds.
 */
export function sanitizeSiteSettingsPayload(
  raw: Record<string, unknown>,
  extraModules: string[] = []
): Record<string, unknown> {
  const merged = { ...DEFAULT_SITE_SETTINGS, ...raw } as Record<string, unknown>;
  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const reqField = (v: unknown, fallback: string, min: number, max: number) => {
    const cleaned = str(v, max);
    return cleaned.length >= min ? cleaned : fallback.slice(0, max);
  };

  const highlightsRaw = Array.isArray(merged.about_highlights) ? merged.about_highlights : [];
  const highlights = highlightsRaw
    .slice(0, 12)
    .map((h) => {
      const item = (h && typeof h === 'object' ? h : {}) as Record<string, unknown>;
      return {
        value: str(item.value, 60),
        label: str(item.label, 120),
      };
    })
    .filter((h) => h.value || h.label);

  const catDescRaw = Array.isArray(merged.courses_category_descriptions)
    ? merged.courses_category_descriptions
    : DEFAULT_COURSE_CATEGORY_DESCRIPTIONS;
  const categoryDescriptions = catDescRaw
    .slice(0, 12)
    .map((c) => {
      const item = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      return {
        category: str(item.category, 120),
        description: str(item.description, 600),
      };
    })
    .filter((c) => c.category || c.description);

  const approachRaw = Array.isArray(merged.courses_approach_steps)
    ? merged.courses_approach_steps
    : [];
  const approachSteps = approachRaw
    .slice(0, 12)
    .map((s) => {
      const item = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      return {
        title: str(item.title, 80),
        description: str(item.description, 300),
      };
    })
    .filter((s) => s.title || s.description);

  const prevMods = Array.isArray(merged.customized_modules)
    ? merged.customized_modules.filter((m): m is string => typeof m === 'string' && m.length > 0)
    : [];
  const customizedModules = Array.from(new Set([...prevMods, ...extraModules])).slice(0, 30);

  const freq =
    merged.popup_frequency === 'once' || merged.popup_frequency === 'always'
      ? merged.popup_frequency
      : 'session';

  return {
    institute_name: reqField(merged.institute_name, DEFAULT_SITE_SETTINGS.institute_name, 2, 120),
    tagline: str(merged.tagline, 400),
    about_heading: str(merged.about_heading, 200),
    about_intro: str(merged.about_intro, 600),
    about_mission: str(merged.about_mission, 400),
    about_story: str(merged.about_story, 8000),
    about_highlights: highlights,
    courses_eyebrow: str(merged.courses_eyebrow, 100),
    courses_title: str(merged.courses_title, 200),
    courses_description: str(merged.courses_description, 600),
    courses_badge: str(merged.courses_badge, 160),
    courses_category_descriptions: categoryDescriptions,
    courses_approach_eyebrow: str(merged.courses_approach_eyebrow, 100),
    courses_approach_title: str(merged.courses_approach_title, 200),
    courses_approach_description: str(merged.courses_approach_description, 600),
    courses_approach_steps: approachSteps,
    logo_url: str(merged.logo_url, 250000),
    logo_width: str(merged.logo_width || '90', 10),
    logo_height: str(merged.logo_height || '55', 10),
    favicon_url: str(merged.favicon_url, 250000),
    phone: reqField(merged.phone, DEFAULT_SITE_SETTINGS.phone, 5, 30),
    email: reqField(merged.email, DEFAULT_SITE_SETTINGS.email, 5, 120),
    whatsapp: str(merged.whatsapp, 30),
    whatsapp_float_enabled: merged.whatsapp_float_enabled !== false,
    whatsapp_prefill_message: str(merged.whatsapp_prefill_message, 300),
    address: reqField(merged.address, DEFAULT_SITE_SETTINGS.address, 3, 300),
    map_embed_url: str(merged.map_embed_url, 1000),
    map_link: str(merged.map_link, 1000),
    office_hours: str(merged.office_hours, 160),
    announcement_enabled: Boolean(merged.announcement_enabled),
    announcement_text: str(merged.announcement_text, 300),
    announcement_bg_color: str(merged.announcement_bg_color, 20),
    announcement_text_color: str(merged.announcement_text_color, 20),
    header_bg_color: str(merged.header_bg_color, 20),
    header_text_color: str(merged.header_text_color, 20),
    footer_about: str(merged.footer_about, 400),
    footer_copyright: str(merged.footer_copyright, 200),
    facebook_url: str(merged.facebook_url, 500),
    instagram_url: str(merged.instagram_url, 500),
    youtube_url: str(merged.youtube_url, 500),
    twitter_url: str(merged.twitter_url, 500),
    seo_title: str(merged.seo_title, 160),
    seo_description: str(merged.seo_description, 320),
    seo_keywords: str(merged.seo_keywords, 300),
    og_image_url: str(merged.og_image_url, 250000),
    popup_enabled: Boolean(merged.popup_enabled),
    popup_title: str(merged.popup_title, 160),
    popup_body: str(merged.popup_body, 500),
    popup_cta_label: str(merged.popup_cta_label, 60),
    popup_cta_link: str(merged.popup_cta_link, 200),
    popup_submit_label: str(merged.popup_submit_label, 80),
    popup_image_url: str(merged.popup_image_url, 250000),
    popup_delay_seconds: Math.max(0, Math.min(120, Number(merged.popup_delay_seconds) || 5)),
    popup_frequency: freq,
    popup_show_parent_name: merged.popup_show_parent_name !== false,
    popup_show_email: merged.popup_show_email !== false,
    popup_show_class: merged.popup_show_class !== false,
    popup_show_course: merged.popup_show_course !== false,
    popup_show_batch: merged.popup_show_batch !== false,
    popup_show_message: Boolean(merged.popup_show_message),
    payments_enabled: Boolean(merged.payments_enabled),
    payment_fee_label: str(merged.payment_fee_label, 120),
    upi_id: str(merged.upi_id, 120),
    payment_qr_url: str(merged.payment_qr_url, 250000),
    bank_details: str(merged.bank_details, 600),
    payment_instructions: str(merged.payment_instructions, 600),
    header_cta_enabled: merged.header_cta_enabled !== false,
    header_cta_label: str(merged.header_cta_label || 'Apply Now', 60),
    header_cta_link: str(merged.header_cta_link || '/admission', 200),
    float_apply_enabled: merged.float_apply_enabled !== false,
    float_apply_label: str(merged.float_apply_label || 'Apply Now', 60),
    float_apply_link: str(merged.float_apply_link || '/admission', 200),
    customized_modules: customizedModules,
    privacy_content: str(merged.privacy_content, 5000),
    terms_content: str(merged.terms_content, 5000),
  };
}

function sortRows<T extends { id: string }>(
  rows: T[],
  sortField?: string,
  sortDir: 'asc' | 'desc' = 'asc'
): T[] {
  if (!sortField) return rows;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortField];
    const bv = (b as Record<string, unknown>)[sortField];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    const as = String(av ?? '');
    const bs = String(bv ?? '');
    return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });
}

export async function getSingleton<T>(collectionName: string, docId: string): Promise<T | null> {
  const path = `${collectionName}/${docId}`;
  try {
    const snap = await getDoc(doc(db, collectionName, docId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function setSingleton(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    const cleanData = { ...data };
    delete cleanData.id;
    await setDoc(doc(db, collectionName, docId), { ...cleanData, updated_at: serverTimestamp() });
    notifyContentUpdated(collectionName);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markModuleCustomized(moduleKeys: string | string[]): Promise<void> {
  const keys = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];
  try {
    const ref = doc(db, 'site_settings', 'main');
    const snap = await getDoc(ref);
    const currentData = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
    const sanitized = sanitizeSiteSettingsPayload(currentData, keys);
    await setDoc(ref, {
      ...sanitized,
      updated_at: serverTimestamp(),
    });
    notifyContentUpdated('site_settings');
  } catch (err) {
    console.warn('Could not mark module customized:', err);
  }
}

export function subscribeSingleton<T>(
  collectionName: string,
  docId: string,
  onData: (data: T | null) => void,
  onError?: (error: unknown) => void
): () => void {
  return onSnapshot(
    doc(db, collectionName, docId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
      } else {
        onData({ id: snap.id, ...snap.data() } as T);
      }
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function fetchCollection<T extends { id: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  sortField?: string,
  sortDir: 'asc' | 'desc' = 'asc'
): Promise<T[]> {
  try {
    const q = constraints.length
      ? query(collection(db, collectionName), ...constraints)
      : collection(db, collectionName);
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as T);
    return sortRows(rows, sortField, sortDir);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  }
}

export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  constraints: QueryConstraint[],
  onData: (rows: T[]) => void,
  sortField?: string,
  sortDir: 'asc' | 'desc' = 'asc',
  onError?: (error: unknown) => void
): () => void {
  const q = constraints.length
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as T);
      onData(sortRows(rows, sortField, sortDir));
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function fetchPublished<T extends { id: string }>(
  collectionName: string,
  sortField = 'display_order',
  sortDir: 'asc' | 'desc' = 'asc',
  maxItems = 100
): Promise<T[]> {
  const fetchCap = Math.max(maxItems, 200);
  const rows = await fetchCollection<T>(
    collectionName,
    [where('is_published', '==', true), limit(fetchCap)],
    sortField,
    sortDir
  );
  return rows.slice(0, maxItems);
}

export function subscribePublished<T extends { id: string }>(
  collectionName: string,
  onData: (rows: T[]) => void,
  sortField = 'display_order',
  sortDir: 'asc' | 'desc' = 'asc',
  maxItems = 100,
  onError?: (error: unknown) => void
): () => void {
  const fetchCap = Math.max(maxItems, 200);
  return subscribeCollection<T>(
    collectionName,
    [where('is_published', '==', true), limit(fetchCap)],
    (rows) => onData(rows.slice(0, maxItems)),
    sortField,
    sortDir,
    onError
  );
}

export async function fetchPublicDocById<T>(collectionName: string, id: string): Promise<T | null> {
  const path = `${collectionName}/${id}`;
  try {
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchPublishedBlogBySlug<T extends { id: string }>(slug: string): Promise<T | null> {
  try {
    const q = query(
      collection(db, 'blogs'),
      where('is_published', '==', true),
      where('slug', '==', slug),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as T;
    }
    return await fetchPublicDocById<T>('blogs', slug);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'blogs');
  }
}

export async function createDocRecord(
  collectionName: string,
  data: Record<string, unknown>,
  customId?: string
): Promise<string> {
  try {
    if (customId) {
      const safeId = sanitizeId(customId);
      await setDoc(doc(db, collectionName, safeId), data);
      notifyContentUpdated(collectionName);
      return safeId;
    }
    const ref = await addDoc(collection(db, collectionName), data);
    notifyContentUpdated(collectionName);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName);
  }
}

export async function updateDocRecord(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await updateDoc(doc(db, collectionName, id), data);
    notifyContentUpdated(collectionName);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setDocRecord(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await setDoc(doc(db, collectionName, id), data);
    notifyContentUpdated(collectionName);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDocRecord(collectionName: string, id: string): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, collectionName, id));
    notifyContentUpdated(collectionName);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function logAdminActivity(action: string, entity: string, summary: string): Promise<void> {
  const email = auth.currentUser?.email || 'admin';
  try {
    await addDoc(collection(db, 'admin_activity'), {
      action: action.slice(0, 40),
      entity: entity.slice(0, 60),
      summary: summary.slice(0, 300),
      actor_email: email.slice(0, 120),
      created_at: serverTimestamp(),
    });
  } catch {
    // Non-blocking audit log
  }
}

export interface EnquiryPayload {
  student_name: string;
  parent_name?: string;
  phone: string;
  email?: string;
  class_level?: string;
  course_name?: string;
  preferred_batch?: string;
  message?: string;
  source?: string;
}

function sanitizeFormText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen);
}

async function sha256HexClient(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h).toString(16).padStart(24, '0');
}

interface ValidatedCheck {
  ok: boolean;
  duplicate?: boolean;
  errors?: Record<string, string>;
  message?: string;
  docId?: string;
  dedupKey?: string;
  sanitized?: Record<string, string>;
}

async function validateEnquiryLocally(
  payload: Record<string, unknown>,
  kind: 'enquiry' | 'admission'
): Promise<ValidatedCheck> {
  const student_name = sanitizeFormText(payload.student_name, 120);
  const parent_name = sanitizeFormText(payload.parent_name, 120);
  const phone = sanitizeFormText(payload.phone, 20);
  const email = sanitizeFormText(payload.email, 120);
  const class_level = sanitizeFormText(payload.class_level, 80);
  const course_name = sanitizeFormText(payload.course_name, 160);
  const preferred_batch = sanitizeFormText(payload.preferred_batch, 80);
  const school = sanitizeFormText(payload.school, 160);
  const address = sanitizeFormText(payload.address, 300);
  const message = sanitizeFormText(payload.message, 2000);
  const source = sanitizeFormText(payload.source, 60) || 'website';

  const errors: Record<string, string> = {};
  if (student_name.length < 2) {
    errors.student_name = "Please enter the student's full name.";
  }
  if (kind === 'admission' && parent_name.length < 2) {
    errors.parent_name = "Please enter the parent or guardian's name.";
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13 || !/^[+0-9\s()-]{10,20}$/.test(phone)) {
    errors.phone = 'Enter a valid mobile number (10–13 digits).';
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (kind === 'admission' && !class_level) {
    errors.class_level = 'Please select the class.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const courseSlug =
    (course_name || 'general')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'general';
  const dateBucket = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dedupKey = `${kind}_${digits}_${courseSlug}_${dateBucket}`;
  const hash = (await sha256HexClient(dedupKey)).slice(0, 24);
  const docId = `${kind === 'admission' ? 'adm' : 'enq'}_${dateBucket}_${hash}`;

  return {
    ok: true,
    docId,
    dedupKey,
    sanitized: {
      student_name,
      parent_name,
      phone,
      email,
      class_level,
      course_name,
      preferred_batch,
      school,
      address,
      message,
      source,
    },
  };
}

async function validateEnquiryWithFallback(
  payload: Record<string, unknown>,
  kind: 'enquiry' | 'admission'
): Promise<ValidatedCheck> {
  try {
    const res = await fetch('/api/validate-enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, kind }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const check = (await res.json().catch(() => null)) as ValidatedCheck | null;
      if (check && (check.ok || check.errors || check.duplicate || check.message)) {
        return check;
      }
    }
  } catch {
    // Fall back to client-side validation when /api/* is unavailable (e.g. Workers static deploy)
  }
  return validateEnquiryLocally(payload, kind);
}

export async function submitValidatedEnquiry(payload: EnquiryPayload): Promise<{
  ok: boolean;
  duplicate?: boolean;
  errors?: Record<string, string>;
  message?: string;
}> {
  const check = await validateEnquiryWithFallback(
    payload as unknown as Record<string, unknown>,
    'enquiry'
  );

  if (!check.ok || !check.docId || !check.sanitized) {
    return {
      ok: false,
      duplicate: Boolean(check.duplicate),
      errors: check.errors,
      message: check.message || 'Please check the form fields and try again.',
    };
  }

  const { docId, dedupKey, sanitized } = check;
  try {
    await setDoc(doc(db, 'enquiries', docId), {
      student_name: sanitized.student_name,
      parent_name: sanitized.parent_name || '',
      phone: sanitized.phone,
      email: sanitized.email || '',
      class_level: sanitized.class_level || '',
      course_name: sanitized.course_name || '',
      preferred_batch: sanitized.preferred_batch || '',
      message: sanitized.message || '',
      source: sanitized.source || 'website',
      status: 'new',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('already exists')) {
      return {
        ok: false,
        duplicate: true,
        message:
          'We already received an enquiry for this mobile number and course today. Our admissions team will contact you shortly.',
      };
    }
    throw err;
  }

  await fetch('/api/confirm-enquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dedupKey }),
  }).catch(() => {});

  return { ok: true };
}

export interface AdmissionPayload {
  student_name: string;
  parent_name: string;
  phone: string;
  email?: string;
  class_level: string;
  course_name?: string;
  preferred_batch?: string;
  school?: string;
  address?: string;
  message?: string;
}

export async function submitValidatedAdmission(payload: AdmissionPayload): Promise<{
  ok: boolean;
  duplicate?: boolean;
  errors?: Record<string, string>;
  message?: string;
  referenceCode?: string;
}> {
  const check = await validateEnquiryWithFallback(
    payload as unknown as Record<string, unknown>,
    'admission'
  );

  if (!check.ok || !check.docId || !check.sanitized) {
    return {
      ok: false,
      duplicate: Boolean(check.duplicate),
      errors: check.errors,
      message: check.message || 'Please check the application fields and try again.',
    };
  }

  const { docId, dedupKey, sanitized } = check;
  const referenceCode = `GSK-${String(docId).slice(-6).toUpperCase()}`;

  try {
    await setDoc(doc(db, 'admissions', docId), {
      student_name: sanitized.student_name,
      parent_name: sanitized.parent_name,
      phone: sanitized.phone,
      email: sanitized.email || '',
      class_level: sanitized.class_level,
      course_name: sanitized.course_name || '',
      preferred_batch: sanitized.preferred_batch || '',
      school: sanitized.school || '',
      address: sanitized.address || '',
      message: sanitized.message || '',
      reference_code: referenceCode,
      status: 'pending',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('already exists')) {
      return {
        ok: false,
        duplicate: true,
        message:
          'An admission application for this mobile number and course was already submitted today. Our office has received it.',
      };
    }
    throw err;
  }

  await fetch('/api/confirm-enquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dedupKey }),
  }).catch(() => {});

  return { ok: true, referenceCode };
}
