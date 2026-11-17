export interface Point {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
}

// Top-Left, Top-Right, Bottom-Right, Bottom-Left
export type Quad = [Point, Point, Point, Point];

export type ScanFilter = 'magic' | 'bw' | 'grayscale' | 'original';

export type PdfPageSize = 'auto' | 'a4' | 'letter';

export interface ScannedPage {
  id: string;
  originalDataUrl: string;
  processedDataUrl: string;
  corners: Quad;
  filter: ScanFilter;
  rotation: 0 | 90 | 180 | 270;
  width: number;
  height: number;
}

export interface SignatureAsset {
  id: string;
  name: string;
  dataUrl: string; // Transparent PNG
  createdAt: number;
}

export type AnnotationType = 'signature' | 'text' | 'date';

export interface PdfAnnotation {
  id: string;
  pageIndex: number; // 0-based
  type: AnnotationType;
  // Normalized coordinates (0..1) relative to page width & height
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl?: string; // For signature PNG
  text?: string; // For text/date
  color?: string;
}

export interface SavedDocument {
  id: string;
  name: string;
  type: 'scan' | 'signed';
  pageCount: number;
  sizeBytes: number;
  pdfBytes: ArrayBuffer;
  thumbnailDataUrl?: string;
  createdAt: number;
  updatedAt: number;
}
