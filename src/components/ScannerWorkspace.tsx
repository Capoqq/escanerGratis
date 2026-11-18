import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  Download,
  FileSignature,
  ImagePlus,
  Loader2,
  RotateCw,
  Share2,
  Trash2,
} from 'lucide-react';
import type { PdfPageSize, Quad, SavedDocument, ScanFilter, ScannedPage } from '../types/document';
import {
  DEFAULT_QUAD,
  detectDocumentCorners,
  imageToCanvas,
  processScannedPage,
} from '../utils/imageProcessor';
import { captureNativePhoto, isNativePlatform, saveOrShareFile, saveOrSharePdf } from '../utils/platform';
import { createPdfFromScannedPages, generatePdfThumbnail } from '../utils/pdfService';
import {
  createDocxFromScannedPages,
  createHtmlFromScannedPages,
  createImagesExport,
  type ExportFormat,
} from '../utils/documentExporter';
import { saveDocumentToVault } from '../utils/storage';
import { CameraModal } from './CameraModal';
import { CornerCropper } from './CornerCropper';

interface ScannerWorkspaceProps {
  onOpenInSigner: (doc: SavedDocument) => void;
  onNotify: (msg: string) => void;
}

const FILTERS: { id: ScanFilter; label: string }[] = [
  { id: 'magic', label: 'Magic Color' },
  { id: 'bw', label: 'Blanco y Negro' },
  { id: 'grayscale', label: 'Grises' },
  { id: 'original', label: 'Original' },
];

export const ScannerWorkspace: React.FC<ScannerWorkspaceProps> = ({
  onOpenInSigner,
  onNotify,
}) => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [docName, setDocName] = useState(
    () => `Escaneo_${new Date().toISOString().slice(0, 10)}`
  );
  const [pageSize, setPageSize] = useState<PdfPageSize>('a4');
  const [jpegQuality, setJpegQuality] = useState<number>(0.84);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedPage = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  const ingestImageDataUrl = async (dataUrl: string) => {
    setIsProcessing(true);
    try {
      const canvas = await imageToCanvas(dataUrl, 1600);
      const corners = detectDocumentCorners(canvas);
      const filter: ScanFilter = 'magic';
      const rotation = 0 as const;
      const { processedDataUrl, width, height } = await processScannedPage(
        dataUrl,
        corners,
        filter,
        rotation,
        jpegQuality
      );

      const newPage: ScannedPage = {
        id: crypto.randomUUID(),
        originalDataUrl: dataUrl,
        processedDataUrl,
        corners,
        filter,
        rotation,
        width,
        height,
      };
      setPages((prev) => [...prev, newPage]);
      setSelectedId(newPage.id);
      setIsCropping(false);
    } catch {
      onNotify('No se pudo procesar la imagen.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenCamera = async () => {
    if (isNativePlatform()) {
      const dataUrl = await captureNativePhoto();
      if (dataUrl) {
        await ingestImageDataUrl(dataUrl);
      }
    } else {
      setShowCamera(true);
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.readAsDataURL(file);
      });
      if (dataUrl) await ingestImageDataUrl(dataUrl);
    }
  };

  const reprocessPage = async (
    page: ScannedPage,
    overrides: Partial<Pick<ScannedPage, 'corners' | 'filter' | 'rotation'>>
  ) => {
    const nextCorners = overrides.corners ?? page.corners;
    const nextFilter = overrides.filter ?? page.filter;
    const nextRotation = overrides.rotation ?? page.rotation;

    setIsProcessing(true);
    try {
      const { processedDataUrl, width, height } = await processScannedPage(
        page.originalDataUrl,
        nextCorners,
        nextFilter,
        nextRotation,
        jpegQuality
      );
      setPages((prev) =>
        prev.map((p) =>
          p.id === page.id
            ? {
                ...p,
                corners: nextCorners,
                filter: nextFilter,
                rotation: nextRotation,
                processedDataUrl,
                width,
                height,
              }
            : p
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateCorners = (corners: Quad) => {
    if (!selectedPage) return;
    setPages((prev) =>
      prev.map((p) => (p.id === selectedPage.id ? { ...p, corners } : p))
    );
  };

  const handleAutoDetectCorners = async () => {
    if (!selectedPage) return;
    const canvas = await imageToCanvas(selectedPage.originalDataUrl, 1200);
    const detected = detectDocumentCorners(canvas) ?? DEFAULT_QUAD;
    handleUpdateCorners(detected);
  };

  const handleApplyCrop = async () => {
    if (!selectedPage) return;
    await reprocessPage(selectedPage, { corners: selectedPage.corners });
    setIsCropping(false);
  };

  const movePage = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    setPages((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const deletePage = (id: string) => {
    setPages((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (selectedId === id) {
        setSelectedId(filtered[0]?.id ?? null);
      }
      return filtered;
    });
  };

  const buildAndExport = async (action: 'download' | 'share' | 'sign') => {
    if (pages.length === 0) return;
    setIsExporting(true);
    try {
      const cleanName = docName.trim() || `Escaneo_${Date.now()}`;

      if (action === 'sign' || exportFormat === 'pdf') {
        const pdfBytes = await createPdfFromScannedPages(pages, pageSize);
        const buffer = pdfBytes.buffer.slice(
          pdfBytes.byteOffset,
          pdfBytes.byteOffset + pdfBytes.byteLength
        ) as ArrayBuffer;
        const thumb = await generatePdfThumbnail(buffer);

        const savedDoc: SavedDocument = {
          id: crypto.randomUUID(),
          name: cleanName,
          type: 'scan',
          pageCount: pages.length,
          sizeBytes: pdfBytes.byteLength,
          pdfBytes: buffer,
          thumbnailDataUrl: thumb,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await saveDocumentToVault(savedDoc);

        if (action === 'sign') {
          onNotify('PDF guardado. Abriendo en el firmador...');
          onOpenInSigner(savedDoc);
        } else {
          await saveOrSharePdf(pdfBytes, cleanName, action === 'share');
          onNotify('PDF optimizado y guardado en Documentos.');
        }
        return;
      }

      const preferShare = action === 'share';

      if (exportFormat === 'docx') {
        const docxBytes = createDocxFromScannedPages(pages, pageSize);
        await saveOrShareFile(
          docxBytes,
          `${cleanName}.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          preferShare
        );
        onNotify('Documento Word (.docx) exportado sin marcas de agua.');
      } else if (exportFormat === 'jpg' || exportFormat === 'png') {
        const exported = await createImagesExport(pages, cleanName, exportFormat);
        await saveOrShareFile(exported.bytes, exported.filename, exported.mimeType, preferShare);
        onNotify(
          pages.length > 1
            ? `Imágenes ${exportFormat.toUpperCase()} empaquetadas en ZIP.`
            : `Imagen ${exportFormat.toUpperCase()} descargada.`
        );
      } else if (exportFormat === 'html') {
        const htmlBytes = createHtmlFromScannedPages(pages, cleanName);
        await saveOrShareFile(htmlBytes, `${cleanName}.html`, 'text/html; charset=utf-8', preferShare);
        onNotify('Documento HTML imprimible exportado.');
      }
    } catch (err) {
      console.error(err);
      onNotify('Error al exportar el documento.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {showCamera && (
        <CameraModal
          onCapture={async (url) => {
            setShowCamera(false);
            await ingestImageDataUrl(url);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {pages.length === 0 ? (
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Camera className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-bold text-white">Escáner Inteligente de Documentos</h2>
            <p className="text-sm text-slate-400">
              Detecta bordes automáticamente, corrige la perspectiva, elimina sombras y genera PDFs
              ligeros 100% en tu dispositivo.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleOpenCamera}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition active:scale-98"
            >
              <Camera className="w-5 h-5" />
              Escanear con Cámara
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 transition"
            >
              <ImagePlus className="w-5 h-5" />
              Subir Fotos / Galería
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left / Main Preview */}
          <div className="lg:col-span-8 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col gap-4">
            {selectedPage && (
              <>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsCropping((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                        isCropping
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Crop className="w-4 h-4" />
                      {isCropping ? 'Editando Recorte' : 'Recorte / Perspectiva'}
                    </button>

                    {!isCropping && (
                      <button
                        onClick={() =>
                          reprocessPage(selectedPage, {
                            rotation: ((selectedPage.rotation + 90) % 360) as
                              | 0
                              | 90
                              | 180
                              | 270,
                          })
                        }
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                      >
                        <RotateCw className="w-4 h-4" />
                        Rotar
                      </button>
                    )}
                  </div>

                  {isCropping ? (
                    <button
                      onClick={handleApplyCrop}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                    >
                      <Check className="w-4 h-4" />
                      Aplicar Recorte
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {selectedPage.width} × {selectedPage.height} px
                    </span>
                  )}
                </div>

                {/* Viewport */}
                <div className="relative flex items-center justify-center min-h-[320px] bg-slate-950/70 rounded-xl p-3">
                  {isProcessing && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs rounded-xl">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        Optimizando...
                      </div>
                    </div>
                  )}

                  {isCropping ? (
                    <CornerCropper
                      imageSrc={selectedPage.originalDataUrl}
                      corners={selectedPage.corners}
                      onChange={handleUpdateCorners}
                      onAutoDetect={handleAutoDetectCorners}
                    />
                  ) : (
                    <img
                      src={selectedPage.processedDataUrl}
                      alt="Documento escaneado"
                      className="max-h-[58vh] w-auto object-contain rounded-lg shadow-2xl"
                    />
                  )}
                </div>

                {/* Filter Selector */}
                {!isCropping && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        disabled={isProcessing}
                        onClick={() => reprocessPage(selectedPage, { filter: f.id })}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                          selectedPage.filter === f.id
                            ? 'bg-indigo-600 text-white shadow'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Panel: Pages & Export */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Multi-page Strip */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Páginas ({pages.length})
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleOpenCamera}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    + Cámara
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    + Foto
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedId(p.id);
                      setIsCropping(false);
                    }}
                    className={`group relative rounded-xl overflow-hidden border-2 cursor-pointer bg-slate-950 transition ${
                      selectedPage?.id === p.id
                        ? 'border-indigo-500'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <img
                      src={p.processedDataUrl}
                      alt={`Página ${idx + 1}`}
                      className="w-full h-28 object-cover"
                    />
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-semibold text-white">
                      {idx + 1}
                    </span>

                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-1 bg-black/70 opacity-100 sm:opacity-0 group-hover:opacity-100 transition">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            movePage(idx, -1);
                          }}
                          disabled={idx === 0}
                          className="p-1 text-slate-200 disabled:opacity-30"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            movePage(idx, 1);
                          }}
                          disabled={idx === pages.length - 1}
                          className="p-1 text-slate-200 disabled:opacity-30"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePage(p.id);
                        }}
                        className="p-1 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Options */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3.5">
              <h3 className="text-sm font-semibold text-white">Exportar y Convertir</h3>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Nombre del documento</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Formato de salida</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="pdf">PDF (.pdf) — Multipágina</option>
                  <option value="docx">Word (.docx) — Documento editable</option>
                  <option value="jpg">Imagen JPG (.jpg / .zip)</option>
                  <option value="png">Imagen PNG (.png / .zip)</option>
                  <option value="html">Web / Imprimible (.html)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Tamaño</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as PdfPageSize)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Carta</option>
                    <option value="auto">Ajuste Auto</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Compresión</label>
                  <select
                    value={jpegQuality}
                    onChange={(e) => setJpegQuality(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value={0.65}>Ligero (65%)</option>
                    <option value={0.84}>Óptimo (84%)</option>
                    <option value={0.94}>Alta (94%)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => buildAndExport('download')}
                  disabled={isExporting || isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {exportFormat === 'pdf'
                    ? 'Guardar y Descargar PDF'
                    : `Exportar como ${exportFormat.toUpperCase()}`}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => buildAndExport('share')}
                    disabled={isExporting || isProcessing}
                    className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Compartir
                  </button>
                  <button
                    onClick={() => buildAndExport('sign')}
                    disabled={isExporting || isProcessing}
                    className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    Ir a Firmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
