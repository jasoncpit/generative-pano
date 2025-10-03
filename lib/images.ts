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
      resolve(Math.abs(ratio - 2) < 0.2);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });


// Build human-friendly titles from file names
function filenameToAlt(name: string): string {
  // Strip only the final extension
  const withoutExt = name.replace(/\.[^./]+$/, "");
  return withoutExt
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Centralized list of gallery images in public/images
const imageFiles = [
  "Armenia_christsmas.jpg",
  "Austria - Schweizerhaus.jpg",
  "Beach House.jpg",
  "Bochum_Langendreer_Oesterheidestr.jpg",
  "Bridge.jpg",
  "Church.jpg",
  "EUparlament.jpg",
  "Forest.jpg",
  "Gallery.jpg",
  "Graffiti.jpg",
  "Harbour.jpg",
  "Hongkong Rooftop.jpg",
  "Japan - Abeno Harukas.jpeg",
  "London - Brompton Oratory.jpg",
  "Norway.jpg",
  "Room.jpg",
  "Snowy Mountain.JPG",
  "Snowy street.jpg",
  "South Africa Garden.jpg",
  "South Korea - House in Sinheung-dong.jpg",
  "St Andrew's Episcopal Church.jpg",
  "Taiwan - 711.jpg",
  "Canada.jpg",
  "Cataratas_do_Iguaçu.jpg",
  "Cool installation.jpg",
  "Somewhere in kazakhstan.jpg",
];

export type GalleryImage = { src: string; alt: string };

export const galleryImages: GalleryImage[] = imageFiles.map((f) => ({
  src: `/images/${f}`,
  alt: filenameToAlt(f),
}));

