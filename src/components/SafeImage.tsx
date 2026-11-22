import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  eager?: boolean;
  fit?: 'cover' | 'contain';
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

function getLocalWebpSource(safeSrc: string): string | null {
  const match = safeSrc.match(/^(\/assets\/gurukul\/(?!favicon\.)[a-zA-Z0-9_-]+)\.png(?:\?.*)?$/i);
  return match ? `${match[1]}.webp` : null;
}

export function SafeImage({
  src,
  alt,
  className = '',
  eager = false,
  fit = 'cover',
  onImageLoad,
}: SafeImageProps) {
  const safeSrc = isSafeImageUrl(src);
  const webpSrc = getLocalWebpSource(safeSrc);
  const [usePngFallback, setUsePngFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUsePngFallback(false);
    setFailed(false);
  }, [safeSrc]);

  if (!safeSrc || failed) {
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

  const activeSrc = !usePngFallback && webpSrc ? webpSrc : safeSrc;

  return (
    <img
      src={activeSrc}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      fetchPriority={eager ? 'high' : undefined}
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        const el = e.currentTarget;
        if (onImageLoad && el.naturalWidth && el.naturalHeight) {
          onImageLoad(el.naturalWidth, el.naturalHeight);
        }
      }}
      onError={() => {
        if (webpSrc && !usePngFallback) {
          setUsePngFallback(true);
        } else {
          setFailed(true);
        }
      }}
      className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
    />
  );
}
