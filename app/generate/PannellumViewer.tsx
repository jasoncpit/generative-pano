'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    pannellum?: any;
  }
}

type PannellumViewerProps = {
  imageUrl: string;
  className?: string;
  hfov?: number; 
  hotSpots?: any[];
};

const PANNELLUM_JS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
const PANNELLUM_CSS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';

function ensurePannellumLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.pannellum) return resolve();

    // Inject CSS once
    if (!document.querySelector(`link[href="${PANNELLUM_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = PANNELLUM_CSS;
      document.head.appendChild(link);
    }

    // Inject script
    const existing = document.querySelector(`script[src="${PANNELLUM_JS}"]`) as HTMLScriptElement | null;
    if (existing && (window as any).pannellum) return resolve();
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Pannellum')));
      return;
    }
    const script = document.createElement('script');
    script.src = PANNELLUM_JS;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Pannellum')));
    document.body.appendChild(script);
  });
}

export default function PannellumViewer({ imageUrl, className, hfov = 90 }: PannellumViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    ensurePannellumLoaded()
      .then(() => {
        if (cancelled || !containerRef.current || !window.pannellum) return;
        // Destroy any previous instance
        try {
          viewerRef.current?.destroy?.();
        } catch {}

        viewerRef.current = window.pannellum.viewer(containerRef.current, {
          type: 'equirectangular',
          panorama: imageUrl,
          autoLoad: true,
          showControls: true,
          hfov
        });
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      try {
        viewerRef.current?.destroy?.();
      } catch {}
    };
  }, [imageUrl, hfov]);
  

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}


