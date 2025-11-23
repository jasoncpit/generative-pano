'use client';

import { useEffect, useRef, useState } from 'react';
import SourcePreview from '@/components/SourcePreview';
import PromptBar from '@/components/PromptBar';
import { checkIsPano, blobToDataUrl } from '@/lib/images';
import VirtualRightArrow from '@/components/VirtualRightArrow';
const RAW = process.env.NEXT_PUBLIC_API_BASE;
const API_BASE = (() => {
  if (!RAW) return '/api/generate';
  if (RAW.endsWith('/api/generate') || RAW.endsWith('/api/generate/')) return RAW;
  try {
    const u = new URL(RAW);
    return `${u.origin}/api/generate`;
  } catch {
    return RAW;
  }
})();

export default function GeneratePage() {
  // Replicate provider only; no BYOK key needed
  const [params, setParams] = useState({ text: '' });
  const [busy, setBusy] = useState(false);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourceIsPano, setSourceIsPano] = useState(false);
  const objUrlRef = useRef<string | null>(null);


  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const src = url.searchParams.get('src');
      if (src) {
        setSourcePreviewUrl(src);
        return;
      }
    } catch {}
    setSourcePreviewUrl(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!sourcePreviewUrl) {
      setSourceIsPano(false);
      return;
    }
    checkIsPano(sourcePreviewUrl).then((isPano) => {
      if (mounted) setSourceIsPano(isPano);
    });
    return () => {
      mounted = false;
    };
  }, [sourcePreviewUrl]);

  const onGenerate = async (textOverride?: string, opts?: { model?: string }) => {
    setBusy(true);
    try {
      const effectiveText = (textOverride ?? params.text) || '';
      let body: any = { provider: 'replicate', params: { text: effectiveText } };
      const src = sourcePreviewUrl;
      
      // Convert image to base64
      const response = await fetch(src);
      const blob = await response.blob();
      const base64 = await blobToDataUrl(blob);

      body.source_image_b64 = base64;
      if (opts?.model) {
        body.params.replicate_model = opts.model;
      }

      const endpoint = API_BASE.endsWith('/api/generate') || API_BASE.endsWith('/api/generate/')
        ? API_BASE
        : `${API_BASE}`;
      console.log('endpoint', endpoint);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        alert(`Generation failed: ${err}`);
        setBusy(false);
        return;
      }
      const resultBlob = await res.blob();
      const url = URL.createObjectURL(resultBlob);
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
      objUrlRef.current = url;
      setSourcePreviewUrl(url);
    } catch (err: any) {
      alert(`Error generating image: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <SourcePreview url={sourcePreviewUrl} isPano={sourceIsPano} />
      <PromptBar busy={busy} onSubmit={(t, opt) => { setParams({ text: t }); onGenerate(t, opt); }} />
      <VirtualRightArrow />
    </main>
  );
}
