import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { DEFAULT_SITE_SETTINGS } from '../data/defaults';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'item';
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
    await setDoc(doc(db, collectionName, docId), { ...data, updated_at: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markModuleCustomized(moduleKeys: string | string[]): Promise<void> {
  const keys = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];
  try {
    const ref = doc(db, 'site_settings', 'main');
    const snap = await getDoc(ref);
    const currentData = snap.exists() ? (snap.data() as Record<string, unknown>) : DEFAULT_SITE_SETTINGS;
    const prev = Array.isArray(currentData.customized_modules)
      ? (currentData.customized_modules as string[])
      : [];
    const merged = Array.from(new Set([...prev, ...keys])).slice(0, 30);
    await setDoc(ref, {
      ...DEFAULT_SITE_SETTINGS,
      ...currentData,
      customized_modules: merged,
      updated_at: serverTimestamp(),
    });
  } catch {
    // Non-blocking sync if admin lacks write or offline
  }
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
    if (sortField) {
      rows.sort((a, b) => {
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
    return rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  }
}

export async function fetchPublished<T extends { id: string }>(
  collectionName: string,
  sortField = 'display_order',
  sortDir: 'asc' | 'desc' = 'asc',
  maxItems = 100
): Promise<T[]> {
  return fetchCollection<T>(
    collectionName,
    [where('is_published', '==', true), limit(maxItems)],
    sortField,
    sortDir
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
      return safeId;
    }
    const ref = await addDoc(collection(db, collectionName), data);
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDocRecord(collectionName: string, id: string): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, collectionName, id));
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
