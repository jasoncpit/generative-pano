'use client';

import { useCallback, useState } from 'react';
import { MorphSurface } from '@/components/smoothui/ui/AiInput';

export default function PromptBar({ busy, onSubmit }: { busy: boolean; onSubmit: (t: string) => void | Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (busy || submitting) return;
      setSubmitting(true);
      try {
        await Promise.resolve(onSubmit(text));
      } finally {
        setSubmitting(false);
      }
    },
    [busy, submitting, onSubmit]
  );

  const isLoading = busy || submitting;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 360,
        maxWidth: '96vw',
      }}
    >
      <MorphSurface
        loading={isLoading}
        disabled={isLoading}
        onSubmit={handleSubmit}
        placeholder={isLoading ? 'Generating...' : 'Describe the re-imagination and press ⌘+Enter'}
      />
    </div>
  );
}
