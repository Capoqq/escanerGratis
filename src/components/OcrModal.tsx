import React, { useState } from 'react';
import { Check, Copy, Download, FileText, Loader2, ScanText, X } from 'lucide-react';
import type { ScannedPage } from '../types/document';
import { createDocxFromText, createTxtBytes } from '../utils/documentExporter';
import { extractTextFromPages, type OcrLanguage, type OcrProgress } from '../utils/ocrService';
import { saveOrShareFile } from '../utils/platform';

interface OcrModalProps {
  pages: ScannedPage[];
  currentPage: ScannedPage;
  docName: string;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const OcrModal: React.FC<OcrModalProps> = ({
  pages,
  currentPage,
  docName,
  onClose,
  onNotify,
}) => {
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [language, setLanguage] = useState<OcrLanguage>('spa');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [copied, setCopied] = useState(false);

  const handleRunOcr = async () => {
    const targetPages = scope === 'all' ? pages : [currentPage];
    setIsRunning(true);
    setProgress({ pageIndex: 0, totalPages: targetPages.length, status: 'Iniciando motor OCR...', progress: 0 });

    try {
      const text = await extractTextFromPages(targetPages, language, (info) => {
        setProgress(info);
      });
      setExtractedText(text || 'No se detectó texto legible en la imagen.');
      onNotify('Texto extraído 100% localmente.');
    } catch (err) {
      console.error(err);
      onNotify('Error al ejecutar el OCR local. Verifica tu conexión la primera vez para descargar el idioma.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = async () => {
    if (!extractedText) return;
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    onNotify('Texto copiado al portapapeles.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = async () => {
    if (!extractedText) return;
    const cleanName = docName.trim() || `OCR_${Date.now()}`;
    await saveOrShareFile(createTxtBytes(extractedText), `${cleanName}.txt`, 'text/plain; charset=utf-8');
    onNotify('Archivo .TXT descargado.');
  };

  const handleDownloadDocx = async () => {
    if (!extractedText) return;
    const cleanName = docName.trim() || `OCR_${Date.now()}`;
    await saveOrShareFile(
      createDocxFromText(extractedText),
      `${cleanName}_texto.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    onNotify('Word (.docx) con texto editable descargado.');
  };

  const pct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ScanText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Reconocimiento de Texto (OCR 100% Local)</h3>
              <p className="text-[11px] text-slate-400">
                Extrae texto editable de tus escaneos gratis y sin subir imágenes a servidores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Cerrar OCR"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Alcance</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'current' | 'all')}
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="current">Página actual</option>
                {pages.length > 1 && <option value="all">Todas las páginas ({pages.length})</option>}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Idioma del documento</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as OcrLanguage)}
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="spa">Español</option>
                <option value="eng">Inglés</option>
                <option value="spa+eng">Español + Inglés</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleRunOcr}
                disabled={isRunning}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <ScanText className="w-4 h-4" />
                    Extraer Texto
                  </>
                )}
              </button>
            </div>
          </div>

          {isRunning && progress && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>
                  Página {progress.pageIndex + 1} de {progress.totalPages} — {progress.status}
                </span>
                <span className="font-semibold text-indigo-400">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Texto extraído (puedes editarlo antes de exportar)</label>
            <textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="Pulsa 'Extraer Texto' para reconocer el contenido de tu documento..."
              rows={9}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs sm:text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={handleCopy}
            disabled={!extractedText}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTxt}
              disabled={!extractedText}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200"
            >
              <FileText className="w-3.5 h-3.5" />
              Descargar .TXT
            </button>
            <button
              onClick={handleDownloadDocx}
              disabled={!extractedText}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white"
            >
              <Download className="w-3.5 h-3.5" />
              Word (.docx) editable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
