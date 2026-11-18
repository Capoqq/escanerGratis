import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfAnnotation, PdfPageSize, ScannedPage } from '../types/document';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const PAGE_DIMENSIONS: Record<Exclude<PdfPageSize, 'auto'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseHexColor(hex?: string) {
  const clean = (hex ?? '#0f172a').replace('#', '');
  if (clean.length !== 6) return rgb(0.06, 0.09, 0.16);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export interface PdfExportOptions {
  twoPerPage?: boolean;
  maxSizeBytes?: number;
}

async function reencodeJpegDataUrl(
  dataUrl: string,
  quality: number,
  maxDimension: number
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo recomprimir la imagen'));
    el.src = dataUrl;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDimension / Math.max(w, h));
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Generates an optimized multi-page PDF from scanned pages.
 * Supports 2-up ID/Cédula layout and optional target max file size compression.
 */
export async function createPdfFromScannedPages(
  pages: ScannedPage[],
  pageSize: PdfPageSize = 'a4',
  options: PdfExportOptions = {}
): Promise<Uint8Array> {
  const { twoPerPage = false, maxSizeBytes } = options;

  const buildPdf = async (sourcePages: ScannedPage[]): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setCreator('DocuScan & Sign');
    pdfDoc.setProducer('DocuScan & Sign');

    if (twoPerPage) {
      const [pageW, pageH] = PAGE_DIMENSIONS[pageSize === 'auto' ? 'a4' : pageSize];
      const margin = 28;
      const gap = 20;
      const slotW = pageW - margin * 2;
      const slotH = (pageH - margin * 2 - gap) / 2;

      for (let i = 0; i < sourcePages.length; i += 2) {
        const page = pdfDoc.addPage([pageW, pageH]);
        const pair = sourcePages.slice(i, i + 2);

        for (let slotIdx = 0; slotIdx < pair.length; slotIdx++) {
          const imgBytes = dataUrlToUint8Array(pair[slotIdx].processedDataUrl);
          const embeddedImg = await pdfDoc.embedJpg(imgBytes);
          const scale = Math.min(slotW / embeddedImg.width, slotH / embeddedImg.height);
          const drawW = embeddedImg.width * scale;
          const drawH = embeddedImg.height * scale;
          const x = (pageW - drawW) / 2;
          const slotBottomY = slotIdx === 0 ? pageH - margin - slotH : margin;
          const y = slotBottomY + (slotH - drawH) / 2;
          page.drawImage(embeddedImg, { x, y, width: drawW, height: drawH });
        }
      }
      return pdfDoc.save({ useObjectStreams: true });
    }

    for (const pageItem of sourcePages) {
      const imgBytes = dataUrlToUint8Array(pageItem.processedDataUrl);
      const embeddedImg = await pdfDoc.embedJpg(imgBytes);
      const imgW = embeddedImg.width;
      const imgH = embeddedImg.height;

      if (pageSize === 'auto') {
        const scale = 595.28 / imgW;
        const w = imgW * scale;
        const h = imgH * scale;
        const page = pdfDoc.addPage([w, h]);
        page.drawImage(embeddedImg, { x: 0, y: 0, width: w, height: h });
      } else {
        const [baseW, baseH] = PAGE_DIMENSIONS[pageSize];
        const isLandscape = imgW > imgH;
        const pageW = isLandscape ? baseH : baseW;
        const pageH = isLandscape ? baseW : baseH;
        const page = pdfDoc.addPage([pageW, pageH]);

        const margin = 18;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const scale = Math.min(maxW / imgW, maxH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        page.drawImage(embeddedImg, { x, y, width: drawW, height: drawH });
      }
    }

    return pdfDoc.save({ useObjectStreams: true });
  };

  let pdfBytes = await buildPdf(pages);

  if (maxSizeBytes && pdfBytes.byteLength > maxSizeBytes) {
    const presets: [number, number][] = [
      [0.72, 1600],
      [0.58, 1300],
      [0.45, 1050],
      [0.35, 850],
    ];
    for (const [quality, maxDim] of presets) {
      const compressedPages = await Promise.all(
        pages.map(async (p) => ({
          ...p,
          processedDataUrl: await reencodeJpegDataUrl(p.processedDataUrl, quality, maxDim),
        }))
      );
      pdfBytes = await buildPdf(compressedPages);
      if (pdfBytes.byteLength <= maxSizeBytes) break;
    }
  }

  return pdfBytes;
}

/**
 * Loads a PDF for rendering with pdf.js using a cloned buffer so the original
 * ArrayBuffer is never detached by the Web Worker.
 */
export async function loadPdfProxy(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  const copy = new Uint8Array(bytes.slice(0));
  const loadingTask = pdfjsLib.getDocument({ data: copy });
  return loadingTask.promise;
}

/**
 * Renders a 0-based PDF page onto a canvas element and returns its CSS pixel dimensions.
 */
export async function renderPdfPageToCanvas(
  pdfDoc: PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  cssWidth: number
): Promise<{ width: number; height: number }> {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const cssScale = cssWidth / unscaledViewport.width;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const viewport = page.getViewport({ scale: cssScale * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const cssHeight = unscaledViewport.height * cssScale;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D no disponible');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return { width: cssWidth, height: cssHeight };
}

/**
 * Generates a small thumbnail DataURL of the first page of a PDF.
 */
export async function generatePdfThumbnail(bytes: ArrayBuffer): Promise<string> {
  try {
    const proxy = await loadPdfProxy(bytes);
    const canvas = document.createElement('canvas');
    await renderPdfPageToCanvas(proxy, 0, canvas, 180);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    await proxy.cleanup();
    return dataUrl;
  } catch {
    return '';
  }
}

/**
 * Flattens signatures, dates, and text annotations onto the uploaded PDF.
 */
export async function exportSignedPdf(
  originalBytes: ArrayBuffer,
  annotations: PdfAnnotation[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Cache embedded PNGs by dataUrl to avoid duplicating image streams
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();

  for (const ann of annotations) {
    const page = pages[ann.pageIndex];
    if (!page) continue;

    const { width: pageW, height: pageH } = page.getSize();
    const boxW = ann.width * pageW;
    const boxH = ann.height * pageH;
    const pdfX = ann.x * pageW;
    // PDF origin is bottom-left; UI origin is top-left
    const pdfY = pageH - ann.y * pageH - boxH;

    if (ann.type === 'signature' && ann.dataUrl) {
      let embedded = imageCache.get(ann.dataUrl);
      if (!embedded) {
        const pngBytes = dataUrlToUint8Array(ann.dataUrl);
        embedded = await pdfDoc.embedPng(pngBytes);
        imageCache.set(ann.dataUrl, embedded);
      }
      page.drawImage(embedded, {
        x: pdfX,
        y: pdfY,
        width: boxW,
        height: boxH,
      });
    } else if ((ann.type === 'text' || ann.type === 'date') && ann.text) {
      const fontSize = Math.max(8, Math.min(36, boxH * 0.58));
      const textY = pdfY + (boxH - fontSize) / 2 + fontSize * 0.15;
      page.drawText(ann.text, {
        x: pdfX + 4,
        y: textY,
        size: fontSize,
        font,
        color: parseHexColor(ann.color),
      });
    }
  }

  return pdfDoc.save({ useObjectStreams: true });
}
