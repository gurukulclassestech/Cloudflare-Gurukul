import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  eager?: boolean;
  fit?: 'cover' | 'contain';
  variant?: 'card' | 'full';
  onImageLoad?: (naturalWidth: number, naturalHeight: number) => void;
}

function isSafeImageUrl(url?: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^blob:/i.test(trimmed)) return trimmed;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function buildImageCandidates(safeSrc: string, variant: 'card' | 'full'): string[] {
  if (!safeSrc) return [];

  // Map legacy /assets/aistudio/* result paths to tracked /assets/gurukul/results/*
  const aistudioMatch = safeSrc.match(
    /^\/assets\/aistudio\/([a-zA-Z0-9_-]+)\.(png|webp)(\?.*)?$/i
  );
  if (aistudioMatch) {
    const fileName = aistudioMatch[1];
    const baseName = fileName.replace(/-thumb$/i, '');
    const candidates: string[] = [];
    if (variant === 'card') {
      candidates.push(`/assets/gurukul/results/${baseName}-thumb.webp`);
    }
    candidates.push(`/assets/gurukul/results/${baseName}.webp`);
    if (variant === 'card') {
      candidates.push(`/assets/aistudio/${baseName}-thumb.webp`);
    }
    candidates.push(`/assets/aistudio/${baseName}.webp`);
    candidates.push(safeSrc);
    return [...new Set(candidates)];
  }

  const gurukulMatch = safeSrc.match(
    /^(\/assets\/gurukul\/(?:results\/)?([a-zA-Z0-9_-]+))\.(png|webp)(\?.*)?$/i
  );
  if (gurukulMatch) {
    const rawBase = gurukulMatch[1];
    const fileName = gurukulMatch[2];
    const lowerName = fileName.toLowerCase();
    const base = rawBase.replace(/-thumb$/i, '');
    const candidates: string[] = [];

    const skipThumb =
      lowerName === 'favicon' || lowerName === 'logo' || lowerName === 'hero_banner_0';

    if (variant === 'card' && !skipThumb) {
      candidates.push(`${base}-thumb.webp`);
    }
    if (lowerName !== 'favicon') {
      candidates.push(`${base}.webp`);
    }
    candidates.push(safeSrc);
    return [...new Set(candidates)];
  }

  return [safeSrc];
}

export function SafeImage({
  src,
  alt,
  className = '',
  eager = false,
  fit = 'cover',
  variant = 'full',
  onImageLoad,
}: SafeImageProps) {
  const safeSrc = isSafeImageUrl(src);
  const candidates = buildImageCandidates(safeSrc, variant);
  const [attemptIndex, setAttemptIndex] = useState(0);

  useEffect(() => {
    setAttemptIndex(0);
  }, [safeSrc, variant]);

  const activeSrc = candidates[attemptIndex] || '';

  if (!safeSrc || !activeSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-2 bg-[hsl(var(--brand-surface))] text-[hsl(var(--brand-navy))]/45 ${className}`}
      >
        <BookOpen className="h-7 w-7" aria-hidden="true" />
        <span className="max-w-[80%] truncate px-2 text-center text-xs font-medium">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : variant === 'card' ? 'low' : 'auto'}
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        const el = e.currentTarget;
        if (onImageLoad && el.naturalWidth && el.naturalHeight) {
          onImageLoad(el.naturalWidth, el.naturalHeight);
        }
      }}
      onError={() => {
        setAttemptIndex((idx) => idx + 1);
      }}
      className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
    />
  );
}
