import React, { useEffect, useRef, useState } from 'react';
import type { Quad } from '../types/document';
import { DEFAULT_QUAD } from '../utils/imageProcessor';
import { Maximize2, Sparkles } from 'lucide-react';

interface CornerCropperProps {
  imageSrc: string;
  corners: Quad;
  onChange: (corners: Quad) => void;
  onAutoDetect: () => void;
}

export const CornerCropper: React.FC<CornerCropperProps> = ({
  imageSrc,
  corners,
  onChange,
  onAutoDetect,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [aspect, setAspect] = useState<number>(3 / 4);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const updatePoint = (clientX: number, clientY: number, idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = Math.min(0.99, Math.max(0.01, (clientX - rect.left) / rect.width));
    const ny = Math.min(0.99, Math.max(0.01, (clientY - rect.top) / rect.height));
    const next: Quad = [
      { ...corners[0] },
      { ...corners[1] },
      { ...corners[2] },
      { ...corners[3] },
    ];
    next[idx] = { x: nx, y: ny };
    onChange(next);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activeIdx === null) return;
    e.preventDefault();
    updatePoint(e.clientX, e.clientY, activeIdx);
  };

  const handlePointerUp = () => {
    setActiveIdx(null);
  };

  const polyPoints = corners.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center justify-between w-full max-w-lg px-1">
        <span className="text-xs text-slate-400">
          Arrastra las 4 esquinas para ajustar la perspectiva
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAutoDetect}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-indigo-300 border border-indigo-500/30"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto-detectar
          </button>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_QUAD)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ aspectRatio: `${aspect}` }}
        className="relative w-full max-w-lg max-h-[60vh] rounded-xl overflow-hidden bg-slate-900 border border-slate-700 touch-none-canvas shadow-2xl"
      >
        <img
          src={imageSrc}
          alt="Vista previa para recorte"
          draggable={false}
          className="w-full h-full object-contain pointer-events-none select-none"
        />

        {/* SVG Polygon Overlay */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <polygon
            points={polyPoints}
            fill="rgba(99, 102, 241, 0.18)"
            stroke="#818cf8"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* 4 Draggable Corner Handles */}
        {corners.map((pt, idx) => (
          <button
            key={idx}
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setActiveIdx(idx);
            }}
            style={{
              left: `${pt.x * 100}%`,
              top: `${pt.y * 100}%`,
            }}
            aria-label={`Esquina ${idx + 1}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
              activeIdx === idx ? 'scale-125' : 'hover:scale-110'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-indigo-500 border-2 border-white shadow-lg" />
          </button>
        ))}
      </div>
    </div>
  );
};
