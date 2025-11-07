'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { galleryImages } from '@/lib/images';

export default function VirtualRightArrow() {
  const router = useRouter();

  const goRandom = useCallback(() => {
    if (!Array.isArray(galleryImages) || galleryImages.length === 0) return;
    const idx = Math.floor(Math.random() * galleryImages.length);
    const img = galleryImages[idx];
    const src = typeof img === 'string' ? img : img.src;
    if (!src) return;
    router.push(`/generate/?src=${encodeURIComponent(src)}`);
    setTimeout(() => {
      window.location.reload();
    }, 50);
  }, [router]);

  return (
    <button
      type="button"
      onClick={goRandom}
      aria-label="Next random image"
      style={{
        position: 'fixed',
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 50,
        width: 56,
        height: 56,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.5)',
        background: 'rgba(255,255,255,0.10)',
        color: 'white',
        backdropFilter: 'blur(8px)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14"/>
        <path d="m12 5 7 7-7 7"/>
      </svg>
    </button>
  );
}


