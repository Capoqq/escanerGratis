import React, { useState } from 'react';
import { Camera, FileSignature, FolderArchive, ShieldCheck } from 'lucide-react';
import type { SavedDocument } from './types/document';
import { ScannerWorkspace } from './components/ScannerWorkspace';
import { PdfSignerWorkspace } from './components/PdfSignerWorkspace';
import { VaultWorkspace } from './components/VaultWorkspace';
import { SeoInfoSection } from './components/SeoInfoSection';

type ActiveTab = 'scanner' | 'signer' | 'vault';

function getInitialTab(): ActiveTab {
  const param = new URLSearchParams(window.location.search).get('tab');
  if (param === 'scanner' || param === 'signer' || param === 'vault') {
    return param;
  }
  if (window.location.pathname.includes('firmar-pdf')) {
    return 'signer';
  }
  return 'scanner';
}

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab);
  const [docForSigner, setDocForSigner] = useState<SavedDocument | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 pb-20 sm:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="DocuScan & Sign" className="w-9 h-9 rounded-xl shadow" />
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                DocuScan &amp; Sign
              </h1>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                100% local en tu dispositivo
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-1.5 bg-slate-900 p-1 rounded-2xl border border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5">
        {activeTab === 'scanner' && (
          <ScannerWorkspace onOpenInSigner={handleOpenInSigner} onNotify={notify} />
        )}
        {activeTab === 'signer' && (
          <PdfSignerWorkspace initialDocument={docForSigner} onNotify={notify} />
        )}
        {activeTab === 'vault' && (
          <VaultWorkspace onOpenInSigner={handleOpenInSigner} onNotify={notify} />
        )}
      </main>

      <SeoInfoSection />

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 grid grid-cols-3 px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-medium transition ${
                active ? 'text-indigo-400' : 'text-slate-400'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''} transition-transform`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
