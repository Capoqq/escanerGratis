<div align="center">

# 📄 DocuScan & Sign — Escáner de Documentos y Firmador de PDF Offline (Web, PWA, Android & iOS)

**Convierte tu móvil o navegador en un escáner de documentos inteligente con detección de bordes, corrección de perspectiva y firma de PDFs 100% local y privada.**

🌐 **[Usar DocuScan & Sign Gratis Online → https://escaner-mobile.pages.dev/](https://escaner-mobile.pages.dev/)**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7-119EFF?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![100% Offline](https://img.shields.io/badge/Privacidad-100%25_Local_y_Offline-10B981?style=flat-square)](#privacidad-y-seguridad)

[Características](#-características-principales) •
[Cómo Funciona](#-cómo-funciona) •
[Instalación Rápida](#-instalación-y-uso) •
[Compilar Android e iOS](#-compilar-app-nativa-android-e-ios) •
[Preguntas Frecuentes](#-preguntas-frecuentes-faq)

</div>

---

## ¿Qué es DocuScan & Sign?

**DocuScan & Sign** es una aplicación web progresiva (**PWA**) y móvil multiplataforma (**Android e iOS** con **Capacitor**) diseñada para **escanear documentos con la cámara**, mejorar su legibilidad automáticamente y **firmar archivos PDF sin subirlos a ningún servidor**.

A diferencia de otros escáneres en línea que envían tus contratos, facturas o documentos de identidad a la nube, todo el procesamiento de imagen y generación de PDF ocurre **100% en tu dispositivo** mediante Canvas 2D, `pdf-lib` y `pdfjs-dist`.

---

## ✨ Características Principales

### 📸 Escáner de Documentos Inteligente (Document Scanner)
- **Captura multiplataforma**: Usa la cámara nativa en **Android/iOS** (`@capacitor/camera`), cámara WebRTC en navegadores (`getUserMedia`) o sube múltiples fotos desde tu galería.
- **Detección automática de bordes**: Algoritmo ligero basado en gradiente Sobel que detecta las 4 esquinas del documento al instante.
- **Recorte con corrección de perspectiva**: Transformación proyectiva (homografía 3×3 con interpolación bilineal) para enderezar hojas fotografiadas en ángulo.
- **Filtros de mejora y eliminación de sombras**:
  - **Magic Color**: Limpia sombras y unifica el fondo blanco del papel manteniendo colores y sellos nítidos.
  - **Blanco y Negro (B&W)**: Umbral adaptativo ideal para texto de alto contraste y PDFs ultraligeros.
  - **Escala de grises** y **Original**.
- **Sesiones multipágina**: Añade varias páginas, rota 90°, reordena, elimina y exporta en tamaño **A4**, **Carta** o **Ajuste Automático** con compresión JPEG configurable.

### ✍️ Firmador de PDF Online y Offline (PDF Signer)
- **Sube cualquier PDF**: Arrastra y suelta archivos PDF o firma directamente los documentos que acabas de escanear.
- **3 formas de crear tu firma**:
  1. **Dibujada a mano**: Lienzo táctil suavizado con curvas Bézier, selector de color (negro, azul tinta, rojo), grosor y recorte automático de márgenes.
  2. **Firma tipográfica**: Escribe tu nombre con estilo manuscrito.
  3. **Desde imagen**: Sube una foto de tu firma con eliminación automática de fondo blanco.
- **Edición visual directa**: Arrastra, cambia el tamaño y posiciona firmas, fechas o anotaciones de texto en cualquier página del PDF.
- **Biblioteca de firmas y bóveda local**: Guarda tus firmas frecuentes en `localStorage` y tus documentos escaneados o firmados en **IndexedDB** para acceso sin conexión.

---

## ⚡ ¿Por qué elegir DocuScan & Sign?

| Característica | DocuScan & Sign | Escáneres tradicionales en la nube |
| :--- | :---: | :---: |
| **Privacidad 100% local (sin servidores)** | ✅ Sí | ❌ Suben tus PDFs a terceros |
| **Funciona sin internet (Offline / PWA)** | ✅ Sí | ❌ Limitado o de pago |
| **Web + Android + iOS desde un solo código** | ✅ React + Capacitor | ❌ Bases de código separadas |
| **Sin marcas de agua ni suscripciones** | ✅ Gratis y abierto | ❌ Requiere plan Pro |
| **Procesamiento rápido sin WASM pesado** | ✅ TypeScript puro | ⚠️ Descargas pesadas |

---

## 🛠 Stack Tecnológico

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite 6](https://vite.dev/)
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Motor PDF**: [pdf-lib](https://pdf-lib.js.org/) (creación y estampado) + [pdfjs-dist](https://mozilla.github.io/pdf.js/) (renderizado local con worker empaquetado)
- **Apps Nativas**: [Capacitor 7](https://capacitorjs.com/) (`@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`)
- **Almacenamiento Local**: IndexedDB + `localStorage`

---

## 🚀 Instalación y Uso

Requisitos previos: **Node.js 20+** y **pnpm** (o npm).

```bash
# 1. Clonar el repositorio
git clone https://github.com/Capoqq/escanerGratis.git
cd escanerGratis

# 2. Instalar dependencias
pnpm install

# 3. Iniciar servidor de desarrollo web
pnpm dev

# 4. Compilar para producción (genera la carpeta dist/)
pnpm build
```

---

## 📱 Compilar App Nativa (Android e iOS)

Gracias a **Capacitor**, puedes empaquetar exactamente la misma aplicación como app nativa para Google Play o App Store:

```bash
# Compilar la web primero
pnpm build

# Añadir plataformas (solo la primera vez)
npx cap add android
npx cap add ios

# Sincronizar cambios y abrir el IDE nativo
npx cap sync
npx cap open android   # Abre Android Studio
npx cap open ios       # Abre Xcode (requiere macOS)
```

---

## 🔒 Privacidad y Seguridad

- **Cero telemetría y cero servidores**: Ningún documento, foto o firma abandona tu navegador o teléfono.
- **Sin dependencias externas en tiempo de ejecución**: El worker de PDF (`pdf.worker.min.mjs`) se incluye en el bundle local para funcionar incluso en modo avión.
- **Dependencias auditadas**: `pdfjs-dist` actualizado a la serie `6.5.x` (sin vulnerabilidades de ejecución arbitraria de JS al abrir PDFs).

---

## ❓ Preguntas Frecuentes (FAQ)

**¿Necesito internet para escanear o firmar un PDF?**
No. Una vez cargada la PWA o instalada la app nativa, puedes escanear documentos, crear firmas y exportar PDFs completamente sin conexión.

**¿El tamaño del PDF generado es ligero para enviar por WhatsApp o correo?**
Sí. Las imágenes se normalizan a una resolución óptima (máximo 1800 px) y puedes elegir entre compresión **Ligera (65%)**, **Óptima (84%)** o **Alta (94%)**.

**¿Puedo usarlo como proyecto base para mi empresa o producto?**
Sí, la arquitectura modular en `src/utils/` (`imageProcessor.ts`, `pdfService.ts`, `storage.ts`, `platform.ts`) facilita adaptarlo e integrarlo con cualquier flujo de trabajo.

---

<div align="center">
  <sub>Hecho con React, TypeScript y Capacitor • Si te resultó útil este proyecto, dale una ⭐ en GitHub</sub>
</div>
