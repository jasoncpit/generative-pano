'use client';

import StaggeredMenu from '@/components/StaggeredMenu';
import { galleryImages } from '@/lib/images';

const goRandom = () => {
    if (!Array.isArray(galleryImages) || galleryImages.length === 0) return;
    const idx = Math.floor(Math.random() * galleryImages.length);
    const img = galleryImages[idx];
    const src = typeof img === 'string' ? img : img.src;
    return '/generate/?src=' + encodeURIComponent(src);
}

const menuItems = [
  { label: 'Home', ariaLabel: 'Go to home page', link: '/' },
  { label: 'About', ariaLabel: 'Learn about us', link: 'https://jt-blog-gamma.vercel.app/' },
  { label: 'Generate', ariaLabel: 'Generate a new image', link: goRandom() },
];

const socialItems = [
  { label: 'GitHub', link: 'https://github.com/jasoncpit/generative-pano' },
  { label: 'LinkedIn', link: 'https://www.linkedin.com/in/jason-tang-37284013a/' },
];


  
export default function SiteMenu() {
  return (
    <StaggeredMenu
      items={menuItems}
      socialItems={socialItems}
      displaySocials={true}
      displayItemNumbering={true}
      menuButtonColor="#fff"
      openMenuButtonColor="#000"
      changeMenuColorOnOpen={true}
      colors={['#B19EEF', '#5227FF']}
      accentColor="#ff6b6b"
      isFixed={true}
      onMenuOpen={() => console.log('Menu opened')}
      onMenuClose={() => console.log('Menu closed')}
    />
  );
}


