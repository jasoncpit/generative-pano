'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DomeGallery, { DomeImage } from '@/components/DomeGallery';

export default function LandingPage() {
  const router = useRouter();
  const items = useMemo<DomeImage[]>(
    () => [
      { src: '/images/img1.jpg', alt: 'Example 1' },
      { src: '/images/img2.jpg', alt: 'Example 2' },
      { src: '/images/im3.jpg', alt: 'Example 3' },
    ],
    []
  );

  const onSelect = (src: string) => {
    router.push(`/generate/?src=${encodeURIComponent(src)}`);
  };

  return (
    <main style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,1)' }}>
      <DomeGallery images={items} onSelect={onSelect} />
      <div
        style={{
          position: 'fixed', left: '50%', top: 24, transform: 'translateX(-50%)', zIndex: 40,
          padding: '8px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.8)',
        }}
      >
        <input type="text" className="subtle" placeholder="Please enter your gemini api key" />
      </div>
    </main>
  );
}


