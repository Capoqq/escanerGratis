import type { ScannedPage } from '../types/document';

export type OcrLanguage = 'spa' | 'eng' | 'spa+eng';

export interface OcrProgress {
  pageIndex: number;
  totalPages: number;
  status: string;
  progress: number; // 0 to 1
}

/**
 * Runs local client-side OCR using Tesseract.js (WebAssembly) without sending
 * any image data to external servers.
 */
export async function extractTextFromPages(
  pages: ScannedPage[],
  language: OcrLanguage = 'spa',
  onProgress?: (info: OcrProgress) => void
): Promise<string> {
  if (pages.length === 0) return '';

  const { createWorker } = await import('tesseract.js');
  let currentPageIndex = 0;

  const worker = await createWorker(language, 1, {
    logger: (msg) => {
      if (onProgress && typeof msg.progress === 'number') {
        onProgress({
          pageIndex: currentPageIndex,
          totalPages: pages.length,
          status: msg.status || 'Procesando...',
          progress: msg.progress,
        });
      }
    },
  });

  try {
    const chunks: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      currentPageIndex = i;
      const result = await worker.recognize(pages[i].processedDataUrl);
      const text = result.data.text.trim();
      if (pages.length > 1) {
        chunks.push(`--- Página ${i + 1} ---\n${text}`);
      } else {
        chunks.push(text);
      }
    }
    return chunks.join('\n\n').trim();
  } finally {
    await worker.terminate();
  }
}
