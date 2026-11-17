import React, { useEffect, useState } from 'react';
import {
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  PenTool,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import type { SavedDocument } from '../types/document';
import { formatBytes, saveOrSharePdf } from '../utils/platform';
import { deleteDocumentFromVault, getAllDocumentsFromVault } from '../utils/storage';

interface VaultWorkspaceProps {
  onOpenInSigner: (doc: SavedDocument) => void;
  onNotify: (msg: string) => void;
}

export const VaultWorkspace: React.FC<VaultWorkspaceProps> = ({
  onOpenInSigner,
  onNotify,
}) => {
  const [docs, setDocs] = useState<SavedDocument[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'scan' | 'signed'>('all');
  const [loading, setLoading] = useState(true);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const list = await getAllDocumentsFromVault();
      setDocs(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteDocumentFromVault(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    onNotify('Documento eliminado.');
  };

  const handleExport = async (doc: SavedDocument, share: boolean) => {
    await saveOrSharePdf(new Uint8Array(doc.pdfBytes), doc.name, share);
  };

  const filtered = docs.filter((d) => {
    if (filter !== 'all' && d.type !== filter) return false;
    if (query.trim() && !d.name.toLowerCase().includes(query.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar documentos..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'scan', label: 'Escaneados' },
            { id: 'signed', label: 'Firmados' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as 'all' | 'scan' | 'signed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">
          Cargando documentos locales...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-10 text-center space-y-3">
          <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">
            No hay documentos guardados
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Los documentos que escanees o firmes se guardarán automáticamente aquí en tu
            dispositivo para acceso sin conexión.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex flex-col hover:border-slate-700 transition"
            >
              <div className="flex gap-3 p-3.5">
                <div className="w-16 h-22 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {doc.thumbnailDataUrl ? (
                    <img
                      src={doc.thumbnailDataUrl}
                      alt={doc.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-6 h-6 text-slate-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-white truncate" title={doc.name}>
                      {doc.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        doc.type === 'signed'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {doc.type === 'signed' ? (
                        <>
                          <FileCheck2 className="w-3 h-3" /> Firmado
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" /> Escaneo
                        </>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {doc.pageCount} {doc.pageCount === 1 ? 'pág.' : 'págs.'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    {formatBytes(doc.sizeBytes)} •{' '}
                    {new Date(doc.updatedAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-4 border-t border-slate-800 bg-slate-950/40 divide-x divide-slate-800">
                <button
                  onClick={() => handleExport(doc, false)}
                  title="Descargar PDF"
                  className="flex items-center justify-center gap-1 py-2.5 text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleExport(doc, true)}
                  title="Compartir PDF"
                  className="flex items-center justify-center gap-1 py-2.5 text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onOpenInSigner(doc)}
                  title="Firmar PDF"
                  className="flex items-center justify-center gap-1 py-2.5 text-xs text-indigo-300 hover:bg-indigo-600/20 transition"
                >
                  <PenTool className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  title="Eliminar"
                  className="flex items-center justify-center gap-1 py-2.5 text-xs text-rose-400 hover:bg-rose-600/20 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
