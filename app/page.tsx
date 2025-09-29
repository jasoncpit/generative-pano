// Main page for the streetview augmenter demo.
// Users paste their own Gemini API key, choose a source panorama URL
// (served from an allowlisted CDN), specify seasonal/weather parameters,
// and click generate. The result is streamed back as a blob URL and
// displayed below the form. This file uses client components ("use client")
// because it relies on browser state.
// https://reactbits.dev/components/dome-gallery 
export { default } from './landing/page';