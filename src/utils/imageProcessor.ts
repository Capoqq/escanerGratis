import type { Point, Quad, ScanFilter } from '../types/document';

export const DEFAULT_QUAD: Quad = [
  { x: 0.07, y: 0.07 },
  { x: 0.93, y: 0.07 },
  { x: 0.93, y: 0.93 },
  { x: 0.07, y: 0.93 },
];

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Draws an image source into a canvas capped at maxDim on its longest side
 * to keep memory low and processing fast on mobile devices.
 */
export async function imageToCanvas(
  src: string,
  maxDim = 1800
): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No se pudo inicializar el contexto 2D');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/**
 * Fast Sobel-based quadrilateral corner heuristic on a downscaled thumbnail.
 * Falls back to DEFAULT_QUAD if no clear document boundary is detected.
 */
export function detectDocumentCorners(sourceCanvas: HTMLCanvasElement): Quad {
  const targetW = 240;
  const scale = targetW / sourceCanvas.width;
  const w = targetW;
  const h = Math.max(40, Math.round(sourceCanvas.height * scale));

  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const sCtx = small.getContext('2d', { willReadFrequently: true });
  if (!sCtx) return DEFAULT_QUAD;
  sCtx.drawImage(sourceCanvas, 0, 0, w, h);

  const { data } = sCtx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Sobel gradient magnitude
  const grad = new Float32Array(w * h);
  let maxGrad = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      const mag = Math.hypot(gx, gy);
      grad[i] = mag;
      if (mag > maxGrad) maxGrad = mag;
    }
  }

  if (maxGrad < 30) return DEFAULT_QUAD;

  const threshold = maxGrad * 0.28;
  const cx = w * 0.5;
  const cy = h * 0.5;

  const bestScore = [-1, -1, -1, -1];
  const bestPts: Point[] = [
    { x: DEFAULT_QUAD[0].x, y: DEFAULT_QUAD[0].y },
    { x: DEFAULT_QUAD[1].x, y: DEFAULT_QUAD[1].y },
    { x: DEFAULT_QUAD[2].x, y: DEFAULT_QUAD[2].y },
    { x: DEFAULT_QUAD[3].x, y: DEFAULT_QUAD[3].y },
  ];

  const marginX = Math.max(4, Math.floor(w * 0.03));
  const marginY = Math.max(4, Math.floor(h * 0.03));

  for (let y = marginY; y < h - marginY; y++) {
    for (let x = marginX; x < w - marginX; x++) {
      const mag = grad[y * w + x];
      if (mag < threshold) continue;

      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.35) continue; // Ignore interior text edges

      // Quadrant: 0=TL, 1=TR, 2=BR, 3=BL
      let q = 0;
      if (x >= cx && y < cy) q = 1;
      else if (x >= cx && y >= cy) q = 2;
      else if (x < cx && y >= cy) q = 3;

      const score = mag * dist;
      if (score > bestScore[q]) {
        bestScore[q] = score;
        bestPts[q] = { x: x / w, y: y / h };
      }
    }
  }

  // Validate area using shoelace formula
  const area =
    0.5 *
    Math.abs(
      bestPts[0].x * bestPts[1].y -
        bestPts[1].x * bestPts[0].y +
        bestPts[1].x * bestPts[2].y -
        bestPts[2].x * bestPts[1].y +
        bestPts[2].x * bestPts[3].y -
        bestPts[3].x * bestPts[2].y +
        bestPts[3].x * bestPts[0].y -
        bestPts[0].x * bestPts[3].y
    );

  if (area < 0.22 || bestScore.some((s) => s < 0)) {
    return DEFAULT_QUAD;
  }

  return [bestPts[0], bestPts[1], bestPts[2], bestPts[3]];
}

/**
 * Solves an 8x8 linear system Ax = b via Gaussian elimination with partial pivoting.
 */
function solve8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) {
        maxRow = row;
      }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let j = col; j <= n; j++) M[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Computes 3x3 homography mapping destination rectangle (0..dstW, 0..dstH)
 * to source quad points in pixel coordinates.
 */
function computeHomography(
  dstW: number,
  dstH: number,
  srcPts: { x: number; y: number }[]
): number[] {
  const dstPts = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH },
  ];

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const u = dstPts[i].x;
    const v = dstPts[i].y;
    const x = srcPts[i].x;
    const y = srcPts[i].y;

    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const h = solve8x8(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * Applies projective perspective warp + rotation to produce a clean rectangular document.
 */
export function warpPerspective(
  sourceCanvas: HTMLCanvasElement,
  corners: Quad,
  rotation: 0 | 90 | 180 | 270 = 0
): HTMLCanvasElement {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  const srcPts = corners.map((p) => ({
    x: p.x * sw,
    y: p.y * sh,
  }));

  const topW = Math.hypot(srcPts[1].x - srcPts[0].x, srcPts[1].y - srcPts[0].y);
  const botW = Math.hypot(srcPts[2].x - srcPts[3].x, srcPts[2].y - srcPts[3].y);
  const leftH = Math.hypot(srcPts[3].x - srcPts[0].x, srcPts[3].y - srcPts[0].y);
  const rightH = Math.hypot(srcPts[2].x - srcPts[1].x, srcPts[2].y - srcPts[1].y);

  let dstW = Math.max(100, Math.round(Math.max(topW, botW)));
  let dstH = Math.max(100, Math.round(Math.max(leftH, rightH)));

  const maxOut = 1800;
  const scale = Math.min(1, maxOut / Math.max(dstW, dstH));
  dstW = Math.round(dstW * scale);
  dstH = Math.round(dstH * scale);

  const H = computeHomography(dstW, dstH, srcPts);

  const sCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sCtx) throw new Error('Contexto 2D no disponible');
  const srcImg = sCtx.getImageData(0, 0, sw, sh);
  const sData = srcImg.data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = dstW;
  outCanvas.height = dstH;
  const oCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!oCtx) throw new Error('Contexto 2D no disponible');
  const dstImg = oCtx.createImageData(dstW, dstH);
  const dData = dstImg.data;

  for (let v = 0; v < dstH; v++) {
    for (let u = 0; u < dstW; u++) {
      const denom = H[6] * u + H[7] * v + 1;
      const sx = (H[0] * u + H[1] * v + H[2]) / denom;
      const sy = (H[3] * u + H[4] * v + H[5]) / denom;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const dIdx = (v * dstW + u) * 4;

      if (x0 < 0 || x0 >= sw - 1 || y0 < 0 || y0 >= sh - 1) {
        const cx = Math.min(sw - 1, Math.max(0, Math.round(sx)));
        const cy = Math.min(sh - 1, Math.max(0, Math.round(sy)));
        const sIdx = (cy * sw + cx) * 4;
        dData[dIdx] = sData[sIdx];
        dData[dIdx + 1] = sData[sIdx + 1];
        dData[dIdx + 2] = sData[sIdx + 2];
        dData[dIdx + 3] = 255;
        continue;
      }

      const fx = sx - x0;
      const fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;

      dData[dIdx] =
        sData[i00] * w00 + sData[i10] * w10 + sData[i01] * w01 + sData[i11] * w11;
      dData[dIdx + 1] =
        sData[i00 + 1] * w00 +
        sData[i10 + 1] * w10 +
        sData[i01 + 1] * w01 +
        sData[i11 + 1] * w11;
      dData[dIdx + 2] =
        sData[i00 + 2] * w00 +
        sData[i10 + 2] * w10 +
        sData[i01 + 2] * w01 +
        sData[i11 + 2] * w11;
      dData[dIdx + 3] = 255;
    }
  }

  oCtx.putImageData(dstImg, 0, 0);

  if (rotation === 0) return outCanvas;
  return rotateCanvas(outCanvas, rotation);
}

export function rotateCanvas(
  canvas: HTMLCanvasElement,
  rotation: 0 | 90 | 180 | 270
): HTMLCanvasElement {
  if (rotation === 0) return canvas;
  const swap = rotation === 90 || rotation === 270;
  const out = document.createElement('canvas');
  out.width = swap ? canvas.height : canvas.width;
  out.height = swap ? canvas.width : canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;

  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

/**
 * Estimates local paper illumination using a fast downscaled background map
 * to remove shadows and uneven lighting in < 20ms.
 */
function estimateBackground(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const bgW = 48;
  const bgH = Math.max(16, Math.round((canvas.height / canvas.width) * bgW));

  const tiny = document.createElement('canvas');
  tiny.width = bgW;
  tiny.height = bgH;
  const tCtx = tiny.getContext('2d', { willReadFrequently: true })!;
  tCtx.drawImage(canvas, 0, 0, bgW, bgH);

  // Dilation pass on tiny grid to ignore dark ink and keep paper brightness
  const tImg = tCtx.getImageData(0, 0, bgW, bgH);
  const src = tImg.data;
  const dilated = new Uint8ClampedArray(src.length);

  for (let y = 0; y < bgH; y++) {
    for (let x = 0; x < bgW; x++) {
      let maxR = 0;
      let maxG = 0;
      let maxB = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const nx = Math.min(bgW - 1, Math.max(0, x + kx));
          const ny = Math.min(bgH - 1, Math.max(0, y + ky));
          const idx = (ny * bgW + nx) * 4;
          if (src[idx] > maxR) maxR = src[idx];
          if (src[idx + 1] > maxG) maxG = src[idx + 1];
          if (src[idx + 2] > maxB) maxB = src[idx + 2];
        }
      }
      const outIdx = (y * bgW + x) * 4;
      dilated[outIdx] = maxR;
      dilated[outIdx + 1] = maxG;
      dilated[outIdx + 2] = maxB;
      dilated[outIdx + 3] = 255;
    }
  }
  tCtx.putImageData(new ImageData(dilated, bgW, bgH), 0, 0);

  // Upscale smoothly back to full canvas size
  const fullBg = document.createElement('canvas');
  fullBg.width = canvas.width;
  fullBg.height = canvas.height;
  const fCtx = fullBg.getContext('2d', { willReadFrequently: true })!;
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';
  fCtx.drawImage(tiny, 0, 0, canvas.width, canvas.height);

  return fCtx.getImageData(0, 0, canvas.width, canvas.height).data;
}

/**
 * Applies fast document enhancement filters (Magic Color, B&W, Grayscale, Original).
 */
export function applyScanFilter(
  sourceCanvas: HTMLCanvasElement,
  filter: ScanFilter
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  if (filter === 'original') return out;

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const data = img.data;

  if (filter === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Gentle contrast boost
      const c = Math.min(255, Math.max(0, (lum - 128) * 1.18 + 134));
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  const bg = estimateBackground(sourceCanvas);

  if (filter === 'magic') {
    for (let i = 0; i < data.length; i += 4) {
      const bgR = Math.max(80, bg[i]);
      const bgG = Math.max(80, bg[i + 1]);
      const bgB = Math.max(80, bg[i + 2]);

      let r = (data[i] / bgR) * 255;
      let g = (data[i + 1] / bgG) * 255;
      let b = (data[i + 2] / bgB) * 255;

      // Boost contrast & push near-white paper to pure white
      r = (r - 128) * 1.25 + 135;
      g = (g - 128) * 1.25 + 135;
      b = (b - 128) * 1.25 + 135;

      if (r > 230 && g > 230 && b > 230) {
        r = 255;
        g = 255;
        b = 255;
      }

      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }
  } else if (filter === 'bw') {
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const bgLum = Math.max(
        60,
        0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2]
      );
      const ratio = lum / bgLum;
      // Crisp adaptive threshold with slight anti-aliased edge
      const val = ratio < 0.78 ? 15 : ratio > 0.88 ? 255 : Math.round(((ratio - 0.78) / 0.1) * 240 + 15);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  ctx.putImageData(img, 0, 0);
  return out;
}

export async function processScannedPage(
  originalDataUrl: string,
  corners: Quad,
  filter: ScanFilter,
  rotation: 0 | 90 | 180 | 270,
  jpegQuality = 0.84
): Promise<{ processedDataUrl: string; width: number; height: number }> {
  const srcCanvas = await imageToCanvas(originalDataUrl, 1800);
  const warped = warpPerspective(srcCanvas, corners, rotation);
  const filtered = applyScanFilter(warped, filter);
  const processedDataUrl = filtered.toDataURL('image/jpeg', jpegQuality);
  return {
    processedDataUrl,
    width: filtered.width,
    height: filtered.height,
  };
}
