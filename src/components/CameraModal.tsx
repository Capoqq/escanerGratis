import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Grid, Upload } from 'lucide-react';

interface CameraModalProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showGrid, setShowGrid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      setError(null);
      setIsReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Tu navegador no permite acceso directo a la cámara. Puedes subir una foto.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch {
        if (active) {
          setError('No se pudo acceder a la cámara. Verifica los permisos o sube una imagen.');
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onCapture(dataUrl);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onCapture(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-md border-b border-white/10">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/10"
        >
          <X className="w-5 h-5" />
          <span>Cerrar</span>
        </button>
        <span className="text-sm font-semibold text-white">Escanear Documento</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid((g) => !g)}
            title="Cuadrícula"
            className={`p-2 rounded-full transition ${
              showGrid ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
            title="Cambiar cámara"
            className="p-2 rounded-full text-slate-300 hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {error ? (
          <div className="max-w-sm mx-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
            <p className="text-sm text-slate-300">{error}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Subir foto desde galería
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            {showGrid && isReady && (
              <div className="pointer-events-none absolute inset-6 border-2 border-indigo-400/50 rounded-xl">
                <div className="absolute inset-x-0 top-1/3 border-t border-white/20" />
                <div className="absolute inset-x-0 top-2/3 border-t border-white/20" />
                <div className="absolute inset-y-0 left-1/3 border-l border-white/20" />
                <div className="absolute inset-y-0 left-2/3 border-l border-white/20" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-around px-6 py-5 bg-slate-950/90 border-t border-white/10">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 text-xs text-slate-300 hover:text-white"
        >
          <div className="p-3 rounded-full bg-slate-800">
            <Upload className="w-5 h-5" />
          </div>
          <span>Galería</span>
        </button>

        <button
          onClick={handleSnap}
          disabled={!isReady}
          aria-label="Capturar documento"
          className="w-18 h-18 rounded-full border-4 border-white p-1 flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
        >
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <Camera className="w-7 h-7 text-slate-900" />
          </div>
        </button>

        <div className="w-12" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFilePick}
      />
    </div>
  );
};
