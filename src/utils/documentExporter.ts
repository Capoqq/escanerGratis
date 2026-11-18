import type { PdfPageSize, ScannedPage } from '../types/document';

export type ExportFormat = 'pdf' | 'docx' | 'jpg' | 'png' | 'html';

const textEncoder = new TextEncoder();

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Builds a standard PKZIP (Store / method 0) archive in pure TypeScript.
 * Compatible with .docx (OOXML) and standard .zip image bundles.
 */
function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // compression: store
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x5421, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // compression: store
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true); // local header offset
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralDirSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralDirSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let cursor = 0;
  for (const part of localParts) {
    result.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    result.set(part, cursor);
    cursor += part.length;
  }
  result.set(eocd, cursor);
  return result;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function dataUrlToPngBytes(dataUrl: string): Promise<Uint8Array> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo convertir la imagen a PNG'));
    el.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D no disponible');
  ctx.drawImage(img, 0, 0);
  const pngUrl = canvas.toDataURL('image/png');
  return dataUrlToBytes(pngUrl);
}

/**
 * Generates a valid Microsoft Word (.docx) file containing all scanned pages
 * fitted cleanly to A4, Letter, or Auto page dimensions.
 */
export function createDocxFromScannedPages(
  pages: ScannedPage[],
  pageSize: PdfPageSize = 'a4'
): Uint8Array {
  // Page sizes in twips (1 pt = 20 twips)
  const baseTwips: [number, number] =
    pageSize === 'letter' ? [12240, 15840] : [11906, 16838]; // Letter or A4
  const marginTwips = 720; // 0.5 inch (36pt)

  const entries: ZipEntry[] = [];
  const relsXmlEntries: string[] = [];
  const bodyParagraphs: string[] = [];

  pages.forEach((page, idx) => {
    const rId = `rId${idx + 1}`;
    const imgName = `image${idx + 1}.jpg`;
    const imgBytes = dataUrlToBytes(page.processedDataUrl);

    entries.push({ name: `word/media/${imgName}`, data: imgBytes });
    relsXmlEntries.push(
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgName}"/>`
    );

    const maxWTwips = baseTwips[0] - marginTwips * 2;
    const maxHTwips = baseTwips[1] - marginTwips * 2;
    // 1 twip = 635 EMU
    const imgW = page.width || 1200;
    const imgH = page.height || 1600;
    const scale = Math.min(maxWTwips / imgW, maxHTwips / imgH);
    const cx = Math.round(imgW * scale * 635);
    const cy = Math.round(imgH * scale * 635);

    const pageBreak = idx > 0 ? '<w:br w:type="page"/>' : '';
    const docPrId = idx + 1;

    bodyParagraphs.push(`
      <w:p>
        <w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r>
          ${pageBreak}
          <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0">
              <wp:extent cx="${cx}" cy="${cy}"/>
              <wp:docPr id="${docPrId}" name="Pagina ${docPrId}"/>
              <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:nvPicPr>
                      <pic:cNvPr id="${docPrId}" name="${imgName}"/>
                      <pic:cNvPicPr/>
                    </pic:nvPicPr>
                    <pic:blipFill>
                      <a:blip r:embed="${rId}"/>
                      <a:stretch><a:fillRect/></a:stretch>
                    </pic:blipFill>
                    <pic:spPr>
                      <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                    </pic:spPr>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>`);
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relsXmlEntries.join('\n  ')}
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    ${bodyParagraphs.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="${baseTwips[0]}" w:h="${baseTwips[1]}"/>
      <w:pgMar w:top="${marginTwips}" w:right="${marginTwips}" w:bottom="${marginTwips}" w:left="${marginTwips}"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  entries.push(
    { name: '[Content_Types].xml', data: textEncoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: textEncoder.encode(rootRelsXml) },
    { name: 'word/_rels/document.xml.rels', data: textEncoder.encode(docRelsXml) },
    { name: 'word/document.xml', data: textEncoder.encode(documentXml) }
  );

  return createZipArchive(entries);
}

/**
 * Exports scanned pages as JPG or PNG (single image file if 1 page, or .zip bundle if multiple).
 */
export async function createImagesExport(
  pages: ScannedPage[],
  baseName: string,
  format: 'jpg' | 'png'
): Promise<{ bytes: Uint8Array; filename: string; mimeType: string }> {
  if (pages.length === 1) {
    const dataUrl = pages[0].processedDataUrl;
    const bytes = format === 'png' ? await dataUrlToPngBytes(dataUrl) : dataUrlToBytes(dataUrl);
    return {
      bytes,
      filename: `${baseName}.${format}`,
      mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    };
  }

  const entries: ZipEntry[] = [];
  for (let i = 0; i < pages.length; i++) {
    const dataUrl = pages[i].processedDataUrl;
    const bytes = format === 'png' ? await dataUrlToPngBytes(dataUrl) : dataUrlToBytes(dataUrl);
    entries.push({
      name: `${baseName}_pagina_${i + 1}.${format}`,
      data: bytes,
    });
  }

  return {
    bytes: createZipArchive(entries),
    filename: `${baseName}_${format}.zip`,
    mimeType: 'application/zip',
  };
}

export function createTxtBytes(text: string): Uint8Array {
  return textEncoder.encode(text);
}

/**
 * Generates an editable Microsoft Word (.docx) file from plain OCR text.
 */
export function createDocxFromText(text: string): Uint8Array {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const lines = text.split(/\r?\n/);
  const paragraphsXml = lines
    .map((line) => {
      const safe = escapeXml(line);
      return `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    })
    .join('\n    ');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return createZipArchive([
    { name: '[Content_Types].xml', data: textEncoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: textEncoder.encode(rootRelsXml) },
    { name: 'word/document.xml', data: textEncoder.encode(documentXml) },
  ]);
}

/**
 * Exports scanned pages as a self-contained printable HTML document.
 */
export function createHtmlFromScannedPages(pages: ScannedPage[], title: string): Uint8Array {
  const escapedTitle = title.replace(/[<>&"]/g, (ch) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch] ?? ch)
  );
  const imgs = pages
    .map(
      (p, i) =>
        `<figure class="page"><img src="${p.processedDataUrl}" alt="${escapedTitle} - Página ${
          i + 1
        }" /></figure>`
    )
    .join('\n    ');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>
  <style>
    body { margin: 0; padding: 24px; background: #0f172a; font-family: system-ui, sans-serif; }
    .page { max-width: 820px; margin: 0 auto 24px; background: #fff; padding: 12px; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
    .page img { width: 100%; height: auto; display: block; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { margin: 0; padding: 0; box-shadow: none; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  ${imgs}
</body>
</html>`;

  return textEncoder.encode(html);
}
