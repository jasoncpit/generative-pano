'use client';

import PannellumViewer from '@/app/generate/PannellumViewer';

export default function SourcePreview({ url, isPano }: { url: string; isPano: boolean }) {
  if (!url) return null;
  if (isPano) {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <PannellumViewer imageUrl={url} />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img style={{ display: 'block', width: '100%', height: '100vh', objectFit: 'cover' }} src={url} alt="Source" />
}


