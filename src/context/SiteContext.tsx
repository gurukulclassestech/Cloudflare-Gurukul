import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import {
  DEFAULT_BANNER,
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_NAV_ITEMS,
  DEFAULT_SITE_SETTINGS,
} from '../data/defaults';
import {
  fetchCollection,
  getSingleton,
  onContentUpdated,
  subscribeCollection,
  subscribeSingleton,
} from '../lib/firestoreApi';
import type { Banner, HomepageSection, NavItem, SiteSettings } from '../types';

interface SiteContextValue {
  site: SiteSettings;
  headerNav: NavItem[];
  footerNav: NavItem[];
  sections: HomepageSection[];
  banners: Banner[];
  loading: boolean;
  reloadSite: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [settingsDoc, setSettingsDoc] = useState<SiteSettings | null>(null);
  const [navRows, setNavRows] = useState<NavItem[] | null>(null);
  const [sectionRows, setSectionRows] = useState<HomepageSection[] | null>(null);
  const [bannerRows, setBannerRows] = useState<Banner[] | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadSite = useCallback(async () => {
    try {
      const [nextSettings, nextNav, nextSections, nextBanners] = await Promise.all([
        getSingleton<SiteSettings>('site_settings', 'main').catch(() => null),
        fetchCollection<NavItem>(
          'nav_items',
          [where('location', 'in', ['header', 'footer'])],
          'display_order',
          'asc'
        ).catch(() => null),
        fetchCollection<HomepageSection>(
          'homepage_sections',
          [where('is_visible', '==', true)],
          'display_order',
          'asc'
        ).catch(() => null),
        fetchCollection<Banner>(
          'banners',
          [where('is_active', '==', true)],
          'display_order',
          'asc'
        ).catch(() => null),
      ]);

      if (nextSettings !== null) setSettingsDoc(nextSettings);
      if (nextNav !== null) setNavRows(nextNav);
      if (nextSections !== null) setSectionRows(nextSections);
      if (nextBanners !== null) setBannerRows(nextBanners);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let settledCount = 0;
    const settledKeys = new Set<string>();
    const markSettled = (key: string) => {
      if (!settledKeys.has(key)) {
        settledKeys.add(key);
        settledCount++;
        if (settledCount >= 4) setLoading(false);
      }
    };

    const unsubs = [
      subscribeSingleton<SiteSettings>(
        'site_settings',
        'main',
        (doc) => {
          setSettingsDoc(doc);
          markSettled('site_settings');
        },
        () => markSettled('site_settings')
      ),
      subscribeCollection<NavItem>(
        'nav_items',
        [where('location', 'in', ['header', 'footer'])],
        (rows) => {
          setNavRows(rows);
          markSettled('nav_items');
        },
        'display_order',
        'asc',
        () => markSettled('nav_items')
      ),
      subscribeCollection<HomepageSection>(
        'homepage_sections',
        [where('is_visible', '==', true)],
        (rows) => {
          setSectionRows(rows);
          markSettled('homepage_sections');
        },
        'display_order',
        'asc',
        () => markSettled('homepage_sections')
      ),
      subscribeCollection<Banner>(
        'banners',
        [where('is_active', '==', true)],
        (rows) => {
          setBannerRows(rows);
          markSettled('banners');
        },
        'display_order',
        'asc',
        () => markSettled('banners')
      ),
    ];

    const unsubBroadcast = onContentUpdated((src) => {
      if (
        src === 'all' ||
        src === 'site_settings' ||
        src === 'nav_items' ||
        src === 'homepage_sections' ||
        src === 'banners'
      ) {
        reloadSite();
      }
    });

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        reloadSite();
      }
    };
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    // Ensure loading clears promptly even if offline
    reloadSite();

    return () => {
      unsubs.forEach((u) => u());
      unsubBroadcast();
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [reloadSite]);

  const value = useMemo<SiteContextValue>(() => {
    const site: SiteSettings = settingsDoc
      ? { ...DEFAULT_SITE_SETTINGS, ...settingsDoc }
      : DEFAULT_SITE_SETTINGS;
    const customized = Array.isArray(site.customized_modules) ? site.customized_modules : [];

    const hasNavData = navRows !== null && (navRows.length > 0 || customized.includes('nav_items'));
    const headerNav = hasNavData
      ? navRows.filter((n) => n.location === 'header')
      : DEFAULT_NAV_ITEMS.filter((i) => i.location === 'header');
    const footerNav = hasNavData
      ? navRows.filter((n) => n.location === 'footer')
      : DEFAULT_NAV_ITEMS.filter((i) => i.location === 'footer');

    const sections =
      sectionRows !== null && (sectionRows.length > 0 || customized.includes('homepage_sections'))
        ? sectionRows
        : DEFAULT_HOMEPAGE_SECTIONS;

    const banners =
      bannerRows !== null && (bannerRows.length > 0 || customized.includes('banners'))
        ? bannerRows
        : [DEFAULT_BANNER];

    return {
      site,
      headerNav,
      footerNav,
      sections,
      banners,
      loading,
      reloadSite,
    };
  }, [settingsDoc, navRows, sectionRows, bannerRows, loading, reloadSite]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside SiteProvider');
  return ctx;
}
