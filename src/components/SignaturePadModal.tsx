import React, { useEffect, useRef, useState } from 'react';
import { Check, Eraser, PenTool, Trash2, Type, Upload, X, Undo2 } from 'lucide-react';
import type { SignatureAsset } from '../types/document';
import {
  deleteSignatureAsset,
  getSavedSignatures,
  saveSignatureAsset,
} from '../utils/storage';

interface SignaturePadModalProps {
  onSelect: (dataUrl: string) => void;
  onClose: () => void;
}

type TabMode = 'saved' | 'draw' | 'type' | 'upload';

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

const PEN_COLORS = [
  { label: 'Negro', value: '#0f172a' },
  { label: 'Azul', value: '#1d4ed8' },
  { label: 'Rojo', value: '#b91c1c' },
];

/**
 * Trims transparent margins from a canvas so the signature bounding box is tight.
 */
function trimCanvasToPng(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const pad = 12;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const oCtx = out.getContext('2d')!;
  oCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL('image/png');
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  onSelect,
  onClose,
}) => {
  const [saved, setSaved] = useState<SignatureAsset[]>(() => getSavedSignatures());
  const [tab, setTab] = useState<TabMode>(() =>
    getSavedSignatures().length > 0 ? 'saved' : 'draw'
  );

  // Draw state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penWidth, setPenWidth] = useState(3.5);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);

  // Type state
  const [typedName, setTypedName] = useState('');
  const [typedColor, setTypedColor] = useState(PEN_COLORS[0].value);

  // Upload state
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const redrawCanvas = (allStrokes: Stroke[], current?: Stroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawOne = (s: Stroke) => {
      if (s.points.length === 0) return;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.points.length === 1) {
        ctx.beginPath();
        ctx.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length - 1; i++) {
        const midX = (s.points[i].x + s.points[i + 1].x) / 2;
        const midY = (s.points[i].y + s.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, midX, midY);
      }
      const last = s.points[s.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    };

    allStrokes.forEach(drawOne);
    if (current) drawOne(current);
  };

  useEffect(() => {
    if (tab === 'draw') {
      redrawCanvas(strokes);
    }
  }, [tab, strokes]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    const stroke: Stroke = { color: penColor, width: penWidth, points: [pt] };
    activeStrokeRef.current = stroke;
    redrawCanvas(strokes, stroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    const pt = getCanvasPoint(e);
    activeStrokeRef.current.points.push(pt);
    redrawCanvas(strokes, activeStrokeRef.current);
  };

  const handlePointerUp = () => {
    if (!activeStrokeRef.current) return;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  const handleSaveDrawn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const png = trimCanvasToPng(canvas);
    if (!png) return;
    const updated = saveSignatureAsset({
      id: crypto.randomUUID(),
      name: `Firma ${saved.length + 1}`,
      dataUrl: png,
      createdAt: Date.now(),
    });
    setSaved(updated);
    onSelect(png);
  };

  const handleSaveTyped = () => {
    const clean = typedName.trim();
    if (!clean) return;
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'italic 68px Georgia, "Times New Roman", serif';
    ctx.fillStyle = typedColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(clean, 24, 100);
    const png = trimCanvasToPng(canvas);
    if (!png) return;
    const updated = saveSignatureAsset({
      id: crypto.randomUUID(),
      name: clean,
      dataUrl: png,
      createdAt: Date.now(),
    });
    setSaved(updated);
    onSelect(png);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const img = new Image();
      img.onload = () => {
        const maxW = 600;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);

        if (removeWhiteBg) {
          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 215 && d[i + 1] > 215 && d[i + 2] > 215) {
              d[i + 3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        const png = trimCanvasToPng(canvas) ?? canvas.toDataURL('image/png');
        const updated = saveSignatureAsset({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^.]+$/, ''),
          dataUrl: png,
          createdAt: Date.now(),
        });
        setSaved(updated);
        onSelect(png);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">Seleccionar o Crear Firma</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-slate-950/60 border-b border-slate-800">
          {[
            { id: 'saved', label: `Guardadas (${saved.length})`, icon: Check },
            { id: 'draw', label: 'Dibujar', icon: PenTool },
            { id: 'type', label: 'Escribir', icon: Type },
            { id: 'upload', label: 'Imagen', icon: Upload },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id as TabMode)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {tab === 'saved' && (
            <div>
              {saved.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-slate-400">Aún no tienes firmas guardadas.</p>
                  <button
                    onClick={() => setTab('draw')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white"
                  >
                    Dibujar mi primera firma
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {saved.map((sig) => (
                    <div
                      key={sig.id}
                      className="group relative rounded-xl bg-white p-3 border-2 border-transparent hover:border-indigo-500 transition cursor-pointer flex items-center justify-center h-28"
                      onClick={() => onSelect(sig.dataUrl)}
                    >
                      <img
                        src={sig.dataUrl}
                        alt={sig.name}
                        className="max-h-full max-w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSaved(deleteSignatureAsset(sig.id));
                        }}
                        title="Eliminar firma"
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-slate-900/80 text-rose-400 opacity-90 sm:opacity-0 group-hover:opacity-100 hover:bg-rose-600 hover:text-white transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'draw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setPenColor(c.value)}
                      title={c.label}
                      style={{ backgroundColor: c.value }}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        penColor === c.value ? 'border-white scale-110' : 'border-slate-600'
                      }`}
                    />
                  ))}
                  <select
                    value={penWidth}
                    onChange={(e) => setPenWidth(Number(e.target.value))}
                    className="ml-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 px-2 py-1"
                  >
                    <option value={2}>Fino</option>
                    <option value={3.5}>Normal</option>
                    <option value={5.5}>Grueso</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStrokes((s) => s.slice(0, -1))}
                    disabled={strokes.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 disabled:opacity-40"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Deshacer
                  </button>
                  <button
                    type="button"
                    onClick={() => setStrokes([])}
                    disabled={strokes.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 disabled:opacity-40"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-white overflow-hidden border border-slate-700">
                <canvas
                  ref={canvasRef}
                  width={680}
                  height={280}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-52 touch-none-canvas cursor-crosshair block"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveDrawn}
                disabled={strokes.length === 0}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-sm transition"
              >
                Usar y Guardar Firma
              </button>
            </div>
          )}

          {tab === 'type' && (
            <div className="space-y-4">
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Escribe tu nombre completo..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Color:</span>
                {PEN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setTypedColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`w-6 h-6 rounded-full border-2 ${
                      typedColor === c.value ? 'border-white scale-110' : 'border-slate-600'
                    }`}
                  />
                ))}
              </div>

              <div className="h-28 rounded-xl bg-white flex items-center justify-center px-4 overflow-hidden">
                <span
                  style={{
                    color: typedColor,
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontStyle: 'italic',
                  }}
                  className="text-4xl truncate"
                >
                  {typedName || 'Vista previa'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveTyped}
                disabled={!typedName.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-sm transition"
              >
                Usar y Guardar Firma
              </button>
            </div>
          )}

          {tab === 'upload' && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeWhiteBg}
                  onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600"
                />
                Eliminar fondo blanco automáticamente (recomendado para fotos de firma)
              </label>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full py-10 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/40 flex flex-col items-center gap-2 text-slate-300 hover:text-white transition"
              >
                <Upload className="w-7 h-7 text-indigo-400" />
                <span className="text-sm font-medium">Seleccionar imagen PNG / JPG</span>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadImage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
