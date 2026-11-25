import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { Header } from './Header';
import { Footer } from './Footer';
import { EnquiryForm } from './EnquiryForm';
import { SafeImage } from './SafeImage';

export function PublicLayout() {
  const { pathname } = useLocation();
  const { site } = useSite();
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    if (!site.popup_enabled || pathname === '/admission') {
      setShowPopup(false);
      return;
    }

    const frequency = site.popup_frequency || 'session';
    if (frequency === 'once' && localStorage.getItem('gurukul_popup_dismissed_once') === '1') {
      return;
    }
    if (frequency === 'session' && sessionStorage.getItem('gurukul_popup_dismissed') === '1') {
      return;
    }

    let interacted = false;
    const markInteracted = () => {
      interacted = true;
    };
    window.addEventListener('scroll', markInteracted, { once: true, passive: true });
    window.addEventListener('pointerdown', markInteracted, { once: true, passive: true });

    const delayMs = Math.max(2, Number(site.popup_delay_seconds) || 5) * 1000;
    const timer = window.setTimeout(() => {
      if (interacted || frequency === 'always') {
        setShowPopup(true);
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', markInteracted);
      window.removeEventListener('pointerdown', markInteracted);
    };
  }, [site.popup_enabled, site.popup_delay_seconds, site.popup_frequency, pathname]);

  const dismissPopup = () => {
    if (site.popup_frequency === 'once') {
      localStorage.setItem('gurukul_popup_dismissed_once', '1');
    } else if (site.popup_frequency !== 'always') {
      sessionStorage.setItem('gurukul_popup_dismissed', '1');
    }
    setShowPopup(false);
  };

  const whatsappDigits = (site.whatsapp || site.phone || '').replace(/\D/g, '');
  const whatsappText =
    site.whatsapp_prefill_message ||
    `Hello ${site.institute_name}, I would like to know about admissions.`;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white text-[hsl(var(--foreground))]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#FFBE1B] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#122B5C]"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="min-w-0 flex-1">
        <Outlet />
      </main>
      <Footer />

      {/* Floating WhatsApp & Apply Now actions */}
      <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-30 flex flex-row-reverse items-center gap-2 sm:bottom-6 sm:right-6 sm:flex-col sm:items-end sm:gap-2.5">
        {whatsappDigits && site.whatsapp_float_enabled !== false && (
          <a
            href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat on WhatsApp"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 sm:h-12 sm:w-12"
          >
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </a>
        )}
        {site.float_apply_enabled !== false && (
          <Link
            to={site.float_apply_link || '/admission'}
            className="inline-flex items-center gap-1 rounded-full bg-[#FFBE1B] px-3 py-2 text-xs font-bold text-[#122B5C] shadow-lg transition hover:scale-[1.03] sm:gap-1.5 sm:px-4 sm:py-3 sm:text-sm"
          >
            <span>{site.float_apply_label || 'Apply Now'}</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* Admission Callback Popup Modal (matching reference yS component) */}
      {showPopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={site.popup_title || 'Admission enquiry'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1D40]/65 p-3 backdrop-blur-xs sm:p-4"
          onClick={dismissPopup}
        >
          <div
            className="surface max-h-[92dvh] w-full max-w-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-[hsl(var(--brand-navy))] px-4 pb-5 pt-6 text-white sm:px-6 sm:pb-6 sm:pt-7">
              <button
                type="button"
                onClick={dismissPopup}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white sm:right-4 sm:top-4"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="eyebrow text-[#FFBE1B]">Admissions</p>
              <h2 className="mt-2 pr-8 text-lg font-bold sm:text-2xl">
                {site.popup_title || 'Admission enquiry'}
              </h2>
              {site.popup_body && (
                <p className="mt-2 text-sm leading-relaxed text-white/75">{site.popup_body}</p>
              )}
            </div>

            {site.popup_image_url && (
              <div className="h-36 overflow-hidden bg-[hsl(var(--brand-surface))] sm:h-40">
                <SafeImage
                  src={site.popup_image_url}
                  alt={site.popup_title || 'Admission notice'}
                  className="h-full w-full"
                />
              </div>
            )}

            <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
              <EnquiryForm
                source="admission-popup"
                compact
                submitLabel={site.popup_submit_label || 'Request a callback'}
                showParentName={site.popup_show_parent_name !== false}
                showEmail={site.popup_show_email !== false}
                showClass={site.popup_show_class !== false}
                showCourse={site.popup_show_course !== false}
                showBatch={site.popup_show_batch !== false}
                showMessage={Boolean(site.popup_show_message)}
                onSuccess={dismissPopup}
              />
              {site.popup_cta_label && (
                <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3 text-xs">
                  <Link
                    to={site.popup_cta_link || '/admission'}
                    onClick={dismissPopup}
                    className="inline-flex items-center gap-1 font-semibold text-[hsl(var(--brand-blue))] hover:underline"
                  >
                    <span>{site.popup_cta_label}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    onClick={dismissPopup}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--brand-navy))]"
                  >
                    Maybe later
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
