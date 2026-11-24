import { useEffect, useRef, useState } from 'react';
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

  const match = safeSrc.match(
    /^(\/assets\/(?:gurukul|aistudio)\/([a-zA-Z0-9_-]+))\.(png|webp)(\?.*)?$/i
  );
  if (!match) return [safeSrc];

  const base = match[1];
  const fileName = match[2].toLowerCase();
  const ext = match[3].toLowerCase();
  const candidates: string[] = [];

  const skipThumb =
    fileName === 'favicon' ||
    fileName === 'logo' ||
    fileName === 'hero_banner_0' ||
    fileName.endsWith('-thumb');

  if (variant === 'card' && !skipThumb) {
    candidates.push(`${base}-thumb.webp`);
  }
  if (ext === 'png' && fileName !== 'favicon') {
    candidates.push(`${base}.webp`);
  }
  candidates.push(safeSrc);

  return [...new Set(candidates)];
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
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const activeSrc = candidates[attemptIndex] || '';

  useEffect(() => {
    setAttemptIndex(0);
    setLoaded(false);
  }, [safeSrc, variant]);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [activeSrc]);

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
    <span className={`relative block overflow-hidden ${className}`}>
      {!eager && !loaded && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-[hsl(var(--brand-surface))]"
        />
      )}
      <img
        ref={imgRef}
        src={activeSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : variant === 'card' ? 'low' : 'auto'}
        referrerPolicy="no-referrer"
        onLoad={(e) => {
          setLoaded(true);
          const el = e.currentTarget;
          if (onImageLoad && el.naturalWidth && el.naturalHeight) {
            onImageLoad(el.naturalWidth, el.naturalHeight);
          }
        }}
        onError={() => {
          if (attemptIndex + 1 < candidates.length) {
            setAttemptIndex((idx) => idx + 1);
          } else {
            setAttemptIndex(candidates.length);
          }
        }}
        className={`block h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${
          eager ? '' : `transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`
        }`}
      />
    </span>
  );
}
