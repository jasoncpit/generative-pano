// Image utilities shared across the app

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });

export const checkIsPano = (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      resolve(Math.abs(ratio - 2) < 0.15);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });


