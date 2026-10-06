import { toBlob } from 'html-to-image';

export async function renderStory(node: HTMLElement): Promise<Blob> {
  // Render at native 1080×1920 regardless of the on-screen preview scale.
  const blob = await toBlob(node, {
    width: 1080,
    height: 1920,
    pixelRatio: 1,
    cacheBust: true,
    style: { transform: 'none', margin: '0' },
  });
  if (!blob) throw new Error('Could not render the story image.');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function canShareFiles(file: File): boolean {
  return typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.canShare?.({ files: [file] }) === true;
}

export type Destination = 'instagram' | 'tiktok' | 'snapchat' | 'whatsapp' | 'native' | 'x' | 'linkedin' | 'copy' | 'download';

export const DESTINATIONS: { id: Destination; label: string; visual: boolean }[] = [
  { id: 'instagram', label: 'Instagram Stories', visual: true },
  { id: 'tiktok', label: 'TikTok', visual: true },
  { id: 'snapchat', label: 'Snapchat', visual: true },
  { id: 'whatsapp', label: 'WhatsApp', visual: false },
  { id: 'native', label: 'Messages & more', visual: true },
  { id: 'x', label: 'X', visual: false },
  { id: 'linkedin', label: 'LinkedIn', visual: false },
  { id: 'copy', label: 'Copy link', visual: false },
];

export function intentUrl(dest: Destination, text: string, url: string): string | null {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  if (dest === 'whatsapp') return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  if (dest === 'x') return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
  if (dest === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
  return null;
}
