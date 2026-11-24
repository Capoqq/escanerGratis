import React, { Suspense, lazy, useState } from 'react';
import {
  Camera,
  FileSignature,
  FileText,
  FolderArchive,
  Loader2,
  ScanText,
  ShieldCheck,
} from 'lucide-react';
import type { SavedDocument } from './types/document';
import { ScannerWorkspace } from './components/ScannerWorkspace';
import { SeoInfoSection } from './components/SeoInfoSection';

const PdfSignerWorkspace = lazy(() =>
  import('./components/PdfSignerWorkspace').then((m) => ({ default: m.PdfSignerWorkspace }))
);
const VaultWorkspace = lazy(() =>
  import('./components/VaultWorkspace').then((m) => ({ default: m.VaultWorkspace }))
);

type ActiveTab = 'scanner' | 'signer' | 'vault';
type RouteContext =
  | 'home'
  | 'escaner-documentos'
  | 'firmar-pdf-gratis'
  | 'foto-a-word'
  | 'alternativa-camscanner';

function getRouteContext(): RouteContext {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('firmar-pdf')) return 'firmar-pdf-gratis';
  if (path.includes('foto-a-word')) return 'foto-a-word';
  if (path.includes('escaner-documentos')) return 'escaner-documentos';
  if (path.includes('alternativa-camscanner')) return 'alternativa-camscanner';
  return 'home';
}

function getInitialTab(): ActiveTab {
  const param = new URLSearchParams(window.location.search).get('tab');
  if (param === 'scanner' || param === 'signer' || param === 'vault') {
    return param;
  }
  const route = getRouteContext();
  if (route === 'firmar-pdf-gratis') {
    return 'signer';
  }
  if (route === 'foto-a-word') {
    return 'scanner';
  }
  return 'scanner';
}

function getPageHero(route: RouteContext, activeTab: ActiveTab): { title: string; subtitle: string } {
  if (route === 'foto-a-word') {
    return {
      title: 'Convertir Foto a Word (.docx) y Extraer Texto OCR Gratis',
      subtitle:
        'Escanea o sube una foto de tu documento y pulsa «Extraer Texto (OCR)» para obtener un Word (.docx) editable 100% local.',
    };
  }
  if (route === 'escaner-documentos') {
    return {
      title: 'Escáner de Documentos Online Gratis y 100% Privado',
      subtitle:
        'Captura con cámara o galería, endereza la perspectiva automáticamente y elimina sombras con Magic Color sin subir archivos.',
    };
  }
  if (route === 'firmar-pdf-gratis') {
    return {
      title: 'Firmar PDF Gratis Online y Sin Internet',
      subtitle:
        'Dibuja, escribe o sube tu firma sin fondo blanco y colócala en cualquier contrato o formulario PDF sin salir de tu dispositivo.',
    };
  }
  if (route === 'alternativa-camscanner') {
    return {
      title: 'Alternativa a CamScanner Gratis, Sin Anuncios y Sin Marcas de Agua',
      subtitle:
        'Digitaliza documentos, ejecuta OCR en español, firma PDFs y exporta a PDF, Word, JPG o PNG sin cuentas ni suscripciones.',
    };
  }

  if (activeTab === 'signer') {
    return {
      title: 'Firmar PDF Gratis Sin Subir Archivos',
      subtitle:
        'Añade tu firma dibujada, tipográfica o desde imagen sin fondo blanco, fecha y anotaciones 100% en tu navegador.',
    };
  }
  if (activeTab === 'vault') {
    return {
      title: 'Documentos Guardados en tu Bóveda Local',
      subtitle:
        'Consulta, descarga o vuelve a firmar tus PDFs almacenados en IndexedDB incluso sin conexión a internet.',
    };
  }
  return {
    title: 'Escáner de Documentos y Firmador de PDF Gratis 100% Local',
    subtitle:
      'Digitaliza páginas con detección de bordes, corrige perspectiva, extrae texto OCR y firma PDFs sin subir archivos a servidores.',
  };
}

function WorkspaceFallback({ label }: { label: string }) {
  return (
    <div className="rounded-3xl bg-[#111827] border border-[rgba(148,163,184,0.18)] p-12 flex flex-col items-center justify-center gap-3 text-[#cbd5e1]">
      <Loader2 className="w-6 h-6 animate-spin text-[#38bdf8]" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function App() {
  const [routeContext] = useState<RouteContext>(getRouteContext);
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab);
  const [docForSigner, setDocForSigner] = useState<SavedDocument | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isPhotoToWord = routeContext === 'foto-a-word';
  const hero = getPageHero(routeContext, activeTab);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleOpenInSigner = (doc: SavedDocument) => {
    setDocForSigner(doc);
    setActiveTab('signer');
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'scanner', label: 'Escáner', icon: Camera },
    { id: 'signer', label: 'Firmar PDF', icon: FileSignature },
    { id: 'vault', label: 'Documentos', icon: FolderArchive },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0b1120] text-[#f8fafc] pb-24 sm:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0b1120]/90 backdrop-blur-md border-b border-[rgba(148,163,184,0.18)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.svg"
              alt="DocuScan & Sign"
              width={36}
              height={36}
              className="w-9 h-9 rounded-xl border border-[rgba(148,163,184,0.18)] shadow-sm"
            />
            <div>
              <span className="block text-base font-bold text-[#f8fafc] leading-tight">
                DocuScan &amp; Sign
              </span>
              <p className="text-[11px] text-[#94a3b8] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                100% local en tu dispositivo
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav
            aria-label="Navegación principal"
            className="hidden sm:flex items-center gap-1.5 bg-[#111827] p-1 rounded-2xl border border-[rgba(148,163,184,0.18)]"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`min-h-[44px] min-w-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                    active
                      ? 'bg-[#38bdf8] text-[#062134] shadow-sm'
                      : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1e293b]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 space-y-5">
        {/* Contextual Page Heading (single semantic H1 per route) */}
        <section
          aria-label="Resumen de la herramienta"
          className={`rounded-2xl border p-4 sm:px-5 sm:py-4 flex flex-col gap-3 ${
            isPhotoToWord
              ? 'bg-[#111827] border-[#10b981]/40'
              : 'bg-[#111827] border-[rgba(148,163,184,0.18)]'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <h1 className="font-bold text-[#f8fafc] tracking-tight">
                {hero.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#cbd5e1] max-w-[68ch] leading-relaxed">
                {hero.subtitle}
              </p>
            </div>

            {isPhotoToWord && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e293b] border border-[rgba(148,163,184,0.18)] text-[11px] font-medium text-[#f8fafc]">
                  <Camera className="w-3.5 h-3.5 text-[#38bdf8]" />
                  1. Sube o escanea foto
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#10b981]/15 border border-[#10b981]/40 text-[11px] font-semibold text-[#34d399]">
                  <ScanText className="w-3.5 h-3.5" />
                  2. OCR → Word (.docx) editable
                </span>
                {activeTab !== 'scanner' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('scanner')}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#38bdf8] hover:bg-[#7dd3fc] text-xs font-semibold text-[#062134] transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ir al Escáner OCR
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {activeTab === 'scanner' && (
          <ScannerWorkspace
            onOpenInSigner={handleOpenInSigner}
            onNotify={notify}
            isPhotoToWord={isPhotoToWord}
          />
        )}
        {activeTab === 'signer' && (
          <Suspense fallback={<WorkspaceFallback label="Cargando módulo de firma PDF..." />}>
            <PdfSignerWorkspace initialDocument={docForSigner} onNotify={notify} />
          </Suspense>
        )}
        {activeTab === 'vault' && (
          <Suspense fallback={<WorkspaceFallback label="Cargando documentos locales..." />}>
            <VaultWorkspace onOpenInSigner={handleOpenInSigner} onNotify={notify} />
          </Suspense>
        )}
      </main>

      <SeoInfoSection />

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navegación móvil"
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0b1120]/95 backdrop-blur-lg border-t border-[rgba(148,163,184,0.18)] grid grid-cols-3 gap-1 px-2 py-1.5"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition ${
                active
                  ? 'bg-[#1e293b] text-[#38bdf8]'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'scale-105' : ''} transition-transform`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[rgba(148,163,184,0.28)] text-xs font-medium text-[#f8fafc] shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
