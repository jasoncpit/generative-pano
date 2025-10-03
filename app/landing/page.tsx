'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DomeGallery, { DomeImage } from '@/components/DomeGallery';
import { galleryImages } from '@/lib/images';

// Site menu is mounted globally in RootLayout


export default function LandingPage() {
  const router = useRouter();
  const items = useMemo<DomeImage[]>(() => galleryImages, []);

  const onSelect = (src: string) => {
    router.push(`/generate/?src=${encodeURIComponent(src)}`);
  };

  return (
    <main style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,1)' }}>
      <DomeGallery images={items} onSelect={onSelect} /> 
    </main>
  );
}


