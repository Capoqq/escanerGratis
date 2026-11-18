import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Captures a photo using native Capacitor Camera plugin when running on Android/iOS.
 * Returns a Data URL or null if cancelled.
 */
export async function captureNativePhoto(): Promise<string | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Converts Uint8Array to base64 string efficiently in chunks.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

/**
 * Downloads or shares any binary file across Web, PWA, Android, and iOS.
 */
export async function saveOrShareFile(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  preferShare = false
): Promise<void> {
  if (isNativePlatform()) {
    const base64Data = uint8ArrayToBase64(bytes);
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });
    await Share.share({
      title: filename,
      url: saved.uri,
      dialogTitle: 'Compartir o guardar documento',
    });
    return;
  }

  // Web / PWA
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
  if (preferShare && typeof navigator !== 'undefined' && navigator.share) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: filename,
          files: [file],
        });
        return;
      }
    } catch {
      // Fallback to standard download if share cancelled or unsupported
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Downloads or shares a PDF file across Web, PWA, Android, and iOS.
 */
export async function saveOrSharePdf(
  bytes: Uint8Array,
  filename: string,
  preferShare = false
): Promise<void> {
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  return saveOrShareFile(bytes, safeName, 'application/pdf', preferShare);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
