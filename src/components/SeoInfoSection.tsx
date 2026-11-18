import { ChevronDown, FileCheck2, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';

const HOW_TO_STEPS = [
  {
    title: '1. Captura o sube tu documento',
    description:
      'Usa la cámara de tu móvil o navegador, o selecciona varias imágenes desde tu galería.',
  },
  {
    title: '2. Ajusta esquinas y aplica filtros',
    description:
      'La detección automática de bordes endereza la perspectiva y Magic Color elimina sombras.',
  },
  {
    title: '3. Exporta a PDF o envía a firmar',
    description:
      'Genera un PDF multipágina en tamaño A4, Carta o Auto, o ábrelo directo en el firmador.',
  },
  {
    title: '4. Firma y descarga al instante',
    description:
      'Dibuja, escribe o sube tu firma (sin fondo blanco), colócala en el PDF y guárdalo localmente.',
  },
];

const FAQ_ITEMS = [
  {
    question: '¿Es gratis escanear y firmar PDFs en DocuScan & Sign?',
    answer:
      'Sí. Todas las herramientas —escaneo multipágina, corrección de perspectiva, filtros Magic Color, firma de PDF y bóveda offline— son 100% gratuitas, sin registro y sin marcas de agua.',
  },
  {
    question: '¿Mis documentos o firmas se suben a algún servidor?',
    answer:
      'No. Todo el procesamiento de imágenes y PDFs se ejecuta íntegramente en tu navegador o dispositivo mediante Canvas 2D, pdf-lib y pdfjs-dist. Ningún archivo sale de tu equipo.',
  },
  {
    question: '¿Funciona sin conexión a internet (offline)?',
    answer:
      'Sí. DocuScan & Sign es una Aplicación Web Progresiva (PWA) con procesamiento local y almacenamiento en IndexedDB, por lo que puedes escanear, firmar y consultar tus documentos sin internet.',
  },
  {
    question: '¿Es una alternativa a CamScanner o Adobe Scan?',
    answer:
      'Sí. Ofrece detección automática de bordes, enderezado de perspectiva, eliminación de sombras (Magic Color) y exportación PDF multipágina sin suscripciones, sin anuncios invasivos y sin marcas de agua.',
  },
  {
    question: '¿Cómo puedo firmar un PDF desde el móvil o PC?',
    answer:
      'Entra en la pestaña «Firmar PDF», sube tu archivo PDF (o envía uno recién escaneado), dibuja o importa tu firma y colócala en cualquier página junto con la fecha o anotaciones de texto.',
  },
  {
    question: '¿Puedo quitar el fondo blanco de una foto de mi firma?',
    answer:
      'Sí. Al subir una imagen de tu firma en papel, la herramienta elimina automáticamente el fondo blanco para que quede transparente sobre cualquier contrato o formulario PDF.',
  },
  {
    question: '¿En qué dispositivos y formatos es compatible?',
    answer:
      'Funciona en navegadores modernos (Chrome, Safari, Edge, Firefox) en Windows, macOS, Linux, Android e iOS. Exporta PDFs estándar en tamaño A4, Carta o Ajuste Automático.',
  },
];

export function SeoInfoSection() {
  return (
    <footer
      aria-label="Información sobre DocuScan & Sign y preguntas frecuentes"
      className="max-w-6xl w-full mx-auto px-4 mt-8 mb-6"
    >
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              Escáner de Documentos y Firmador de PDF 100% Local y Privado
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Escanea documentos con tu cámara, corrige la perspectiva automáticamente, mejora la
              legibilidad con <strong className="text-slate-300">Magic Color</strong> y firma
              archivos PDF gratis sin subir tus datos a la nube ni añadir marcas de agua.
            </p>
          </div>
          <a
            href="/llms.txt"
            className="text-[11px] text-slate-400 hover:text-indigo-400 transition shrink-0 underline underline-offset-4"
          >
            Información para IA (llms.txt)
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <details className="group rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <summary className="flex items-center justify-between cursor-pointer list-none text-xs sm:text-sm font-medium text-slate-200">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Cómo escanear y firmar un PDF paso a paso
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="mt-3 space-y-2.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
              {HOW_TO_STEPS.map((step) => (
                <li key={step.title}>
                  <h3 className="font-semibold text-slate-200">{step.title}</h3>
                  <p className="mt-0.5 leading-relaxed">{step.description}</p>
                </li>
              ))}
            </ol>
          </details>

          <details className="group rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <summary className="flex items-center justify-between cursor-pointer list-none text-xs sm:text-sm font-medium text-slate-200">
              <span className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-sky-400" />
                Características principales sin servidores
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mt-3 space-y-2 text-xs text-slate-400 border-t border-slate-800/80 pt-3 list-disc list-inside">
              <li>
                <strong className="text-slate-200">Detección de bordes y perspectiva:</strong>{' '}
                recorte inteligente con homografía 3×3 para enderezar hojas en ángulo.
              </li>
              <li>
                <strong className="text-slate-200">Filtros profesionales:</strong> Magic Color,
                Blanco y Negro adaptativo, Escala de Grises y Original.
              </li>
              <li>
                <strong className="text-slate-200">Firmador PDF completo:</strong> firma dibujada,
                tipográfica o desde foto con eliminación automática de fondo blanco.
              </li>
              <li>
                <strong className="text-slate-200">Bóveda local (IndexedDB):</strong> guarda y
                reutiliza tus documentos y firmas sin conexión a internet.
              </li>
            </ul>
          </details>
        </div>

        <details className="group rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <summary className="flex items-center justify-between cursor-pointer list-none text-xs sm:text-sm font-medium text-slate-200">
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              Preguntas frecuentes (FAQ) sobre privacidad, uso offline y compatibilidad
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 border-t border-slate-800/80 pt-3">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question} className="space-y-1">
                <dt className="text-xs font-semibold text-slate-200">{item.question}</dt>
                <dd className="text-xs text-slate-400 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </footer>
  );
}
