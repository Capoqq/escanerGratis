import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Loader2,
  PenTool,
  Share2,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PdfAnnotation, SavedDocument } from '../types/document';
import {
  exportSignedPdf,
  generatePdfThumbnail,
  loadPdfProxy,
  renderPdfPageToCanvas,
} from '../utils/pdfService';
import { saveOrSharePdf } from '../utils/platform';
import { saveDocumentToVault } from '../utils/storage';
import { SignaturePadModal } from './SignaturePadModal';

interface PdfSignerWorkspaceProps {
  initialDocument: SavedDocument | null;
  onNotify: (msg: string) => void;
}

export const PdfSignerWorkspace: React.FC<PdfSignerWorkspaceProps> = ({
  initialDocument,
  onNotify,
}) => {
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfProxy, setPdfProxy] = useState<PDFDocumentProxy | null>(null);
  const [docName, setDocName] = useState('Documento_Firmado');
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [showSigModal, setShowSigModal] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pageCssSize, setPageCssSize] = useState<{ width: number; height: number }>({
    width: 600,
    height: 840,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dragStateRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const openPdfBuffer = async (buffer: ArrayBuffer, name: string) => {
    setIsLoadingPdf(true);
    try {
      if (pdfProxy) {
        await pdfProxy.cleanup();
      }
      const proxy = await loadPdfProxy(buffer);
      setPdfBytes(buffer);
      setPdfProxy(proxy);
      setNumPages(proxy.numPages);
      setCurrentPage(0);
      setAnnotations([]);
      setSelectedAnnId(null);
      setDocName(name.replace(/\.pdf$/i, ''));
    } catch {
      onNotify('No se pudo abrir el archivo PDF. Verifica que no esté dañado o cifrado.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  useEffect(() => {
    if (initialDocument) {
      openPdfBuffer(initialDocument.pdfBytes, `${initialDocument.name}_firmado`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocument?.id]);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!pdfProxy || !canvasRef.current) return;
      const containerW = stageWrapperRef.current?.clientWidth ?? 640;
      const baseWidth = Math.min(720, Math.max(280, containerW - 24));
      const targetWidth = Math.round(baseWidth * zoom);
      const size = await renderPdfPageToCanvas(
        pdfProxy,
        currentPage,
        canvasRef.current,
        targetWidth
      );
      if (!cancelled) {
        setPageCssSize(size);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [pdfProxy, currentPage, zoom]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await openPdfBuffer(buffer, file.name);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      const buffer = await file.arrayBuffer();
      await openPdfBuffer(buffer, file.name);
    }
  };

  const addSignatureAnnotation = (dataUrl: string) => {
    setShowSigModal(false);
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
      const width = 0.28;
      const pageAspect = pageCssSize.width / Math.max(1, pageCssSize.height);
      const height = Math.min(0.25, Math.max(0.06, (width * pageAspect) / aspect));
      const newAnn: PdfAnnotation = {
        id: crypto.randomUUID(),
        pageIndex: currentPage,
        type: 'signature',
        x: 0.36,
        y: 0.65,
        width,
        height,
        dataUrl,
      };
      setAnnotations((prev) => [...prev, newAnn]);
      setSelectedAnnId(newAnn.id);
    };
    img.src = dataUrl;
  };

  const addDateAnnotation = () => {
    const today = new Date().toLocaleDateString('es-ES');
    const newAnn: PdfAnnotation = {
      id: crypto.randomUUID(),
      pageIndex: currentPage,
      type: 'date',
      x: 0.38,
      y: 0.78,
      width: 0.22,
      height: 0.045,
      text: today,
      color: '#0f172a',
    };
    setAnnotations((prev) => [...prev, newAnn]);
    setSelectedAnnId(newAnn.id);
  };

  const addTextAnnotation = () => {
    const clean = customText.trim();
    if (!clean) return;
    const newAnn: PdfAnnotation = {
      id: crypto.randomUUID(),
      pageIndex: currentPage,
      type: 'text',
      x: 0.3,
      y: 0.5,
      width: Math.min(0.6, Math.max(0.2, clean.length * 0.018)),
      height: 0.045,
      text: clean,
      color: '#0f172a',
    };
    setAnnotations((prev) => [...prev, newAnn]);
    setSelectedAnnId(newAnn.id);
    setCustomText('');
    setTextModalOpen(false);
  };

  const handleStagePointerMove = (e: React.PointerEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    e.preventDefault();

    const dx = (e.clientX - drag.startX) / Math.max(1, pageCssSize.width);
    const dy = (e.clientY - drag.startY) / Math.max(1, pageCssSize.height);

    setAnnotations((prev) =>
      prev.map((ann) => {
        if (ann.id !== drag.id) return ann;
        if (drag.mode === 'move') {
          return {
            ...ann,
            x: Math.min(1 - ann.width, Math.max(0, drag.origX + dx)),
            y: Math.min(1 - ann.height, Math.max(0, drag.origY + dy)),
          };
        }
        return {
          ...ann,
          width: Math.min(1 - ann.x, Math.max(0.08, drag.origW + dx)),
          height: Math.min(1 - ann.y, Math.max(0.03, drag.origH + dy)),
        };
      })
    );
  };

  const handleStagePointerUp = () => {
    dragStateRef.current = null;
  };

  const handleExport = async (preferShare: boolean) => {
    if (!pdfBytes) return;
    setIsExporting(true);
    try {
      const signedBytes = await exportSignedPdf(pdfBytes, annotations);
      const buffer = signedBytes.buffer.slice(
        signedBytes.byteOffset,
        signedBytes.byteOffset + signedBytes.byteLength
      ) as ArrayBuffer;
      const thumb = await generatePdfThumbnail(buffer);
      const finalName = docName.trim() || `Firmado_${Date.now()}`;

      await saveDocumentToVault({
        id: crypto.randomUUID(),
        name: finalName,
        type: 'signed',
        pageCount: numPages,
        sizeBytes: signedBytes.byteLength,
        pdfBytes: buffer,
        thumbnailDataUrl: thumb,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await saveOrSharePdf(signedBytes, finalName, preferShare);
      onNotify('PDF firmado guardado y exportado correctamente.');
    } catch (err) {
      console.error(err);
      onNotify('Error al exportar el PDF firmado.');
    } finally {
      setIsExporting(false);
    }
  };

  const pageAnnotations = annotations.filter((a) => a.pageIndex === currentPage);

  return (
    <div className="flex flex-col gap-4">
      {showSigModal && (
        <SignaturePadModal
          onSelect={addSignatureAnnotation}
          onClose={() => setShowSigModal(false)}
        />
      )}

      {textModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Añadir texto al PDF</h3>
            <input
              type="text"
              autoFocus
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTextAnnotation()}
              placeholder="Ej: Nombre, DNI, Cargo..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTextModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={addTextAnnotation}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white"
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {!pdfBytes ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="rounded-3xl bg-slate-900/70 border-2 border-dashed border-slate-700 hover:border-indigo-500/70 p-8 sm:p-12 text-center space-y-5 transition"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <FileUp className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-bold text-white">Subir PDF para Firmar</h2>
            <p className="text-sm text-slate-400">
              Arrastra un documento PDF aquí o selecciónalo desde tu dispositivo. Tus firmas se
              procesan 100% en local.
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoadingPdf}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition"
          >
            {isLoadingPdf ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileUp className="w-5 h-5" />
            )}
            Seleccionar Archivo PDF
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Action & Signing Toolbar */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowSigModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow"
              >
                <PenTool className="w-4 h-4" />
                Añadir Firma
              </button>
              <button
                onClick={addDateAnnotation}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
              >
                <Calendar className="w-4 h-4 text-sky-400" />
                Fecha
              </button>
              <button
                onClick={() => setTextModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
              >
                <Type className="w-4 h-4 text-amber-400" />
                Texto
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                <FileUp className="w-4 h-4" />
                Otro PDF
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                aria-label="Nombre del PDF"
                className="w-36 sm:w-44 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              />
              <button
                onClick={() => handleExport(false)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Exportar
              </button>
              <button
                onClick={() => handleExport(true)}
                disabled={isExporting}
                title="Compartir PDF firmado"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Page Navigation & Zoom */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-slate-300">
                Página {currentPage + 1} de {numPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
                disabled={currentPage >= numPages - 1}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-300 w-11 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PDF Canvas + Annotation Overlay */}
          <div
            ref={stageWrapperRef}
            onClick={() => setSelectedAnnId(null)}
            className="w-full overflow-auto rounded-2xl bg-slate-950/90 border border-slate-800 p-3 flex justify-center min-h-[60vh]"
          >
            <div
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              onPointerCancel={handleStagePointerUp}
              style={{ width: pageCssSize.width, height: pageCssSize.height }}
              className="relative shadow-2xl bg-white touch-none-canvas shrink-0"
            >
              <canvas ref={canvasRef} className="block" />

              {pageAnnotations.map((ann) => {
                const isSelected = selectedAnnId === ann.id;
                return (
                  <div
                    key={ann.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnnId(ann.id);
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      setSelectedAnnId(ann.id);
                      dragStateRef.current = {
                        id: ann.id,
                        mode: 'move',
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: ann.x,
                        origY: ann.y,
                        origW: ann.width,
                        origH: ann.height,
                      };
                    }}
                    style={{
                      left: `${ann.x * 100}%`,
                      top: `${ann.y * 100}%`,
                      width: `${ann.width * 100}%`,
                      height: `${ann.height * 100}%`,
                    }}
                    className={`absolute cursor-move select-none flex items-center justify-center rounded ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 bg-indigo-500/10'
                        : 'hover:ring-1 hover:ring-indigo-400/60'
                    }`}
                  >
                    {ann.type === 'signature' && ann.dataUrl ? (
                      <img
                        src={ann.dataUrl}
                        alt="Firma"
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <span
                        style={{
                          color: ann.color ?? '#0f172a',
                          fontSize: `${Math.max(10, ann.height * pageCssSize.height * 0.56)}px`,
                        }}
                        className="font-bold whitespace-nowrap pointer-events-none px-1"
                      >
                        {ann.text}
                      </span>
                    )}

                    {isSelected && (
                      <>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnnotations((prev) => prev.filter((a) => a.id !== ann.id));
                          }}
                          className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            dragStateRef.current = {
                              id: ann.id,
                              mode: 'resize',
                              startX: e.clientX,
                              startY: e.clientY,
                              origX: ann.x,
                              origY: ann.y,
                              origW: ann.width,
                              origH: ann.height,
                            };
                          }}
                          className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white cursor-nwse-resize shadow"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
