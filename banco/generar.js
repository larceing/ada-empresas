// Banco de pruebas: genera correos inventados (.eml) con y sin adjuntos (PDF con texto, PDF escaneado, Excel).
// Todo es inventado: empresas, personas y dominios .test. Uso: node banco/generar.js
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'correos');

// ---------- PDF mínimo con texto (Helvetica, una página) ----------
export function pdfTexto(lineas) {
  const esc = (t) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const flujo = 'BT /F1 10 Tf 12 TL 50 790 Td\n' + lineas.map((l) => `(${esc(l)}) '`).join('\n') + '\nET';
  return pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(flujo, 'latin1')} >>\nstream\n${flujo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]);
}
// PDF «escaneado»: solo dibujo, sin texto (rectángulos que imitan renglones).
export function pdfEscaneado() {
  let d = '0.2 g\n';
  for (let i = 0; i < 18; i++) d += `50 ${780 - i * 22} ${200 + ((i * 37) % 280)} 8 re f\n`;
  return pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>',
    `<< /Length ${d.length} >>\nstream\n${d}endstream`,
  ]);
}
function pdf(objs) {
  let out = '%PDF-1.4\n';
  const pos = [];
  objs.forEach((o, i) => { pos.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + pos.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ---------- .xlsx mínimo (una hoja, cadenas en línea) ----------
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function zip(archivos) {
  const locales = [], centrales = [];
  let off = 0;
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const datos = Buffer.from(contenido, 'utf8');
    const comp = zlib.deflateRawSync(datos);
    const n = Buffer.from(nombre);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(8, 8);
    l.writeUInt32LE(crc32(datos), 14); l.writeUInt32LE(comp.length, 18); l.writeUInt32LE(datos.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc32(datos), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(datos.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    locales.push(l, n, comp); centrales.push(c, n);
    off += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(centrales);
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(archivos).length, 8); fin.writeUInt16LE(Object.keys(archivos).length, 10);
  fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(off, 16);
  return Buffer.concat([...locales, cd, fin]);
}
export function xlsx(filas) {
  const x = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const celdas = filas.map((f, r) => `<row r="${r + 1}">` + f.map((v) => (typeof v === 'number' ? `<c><v>${v}</v></c>` : `<c t="inlineStr"><is><t>${x(v)}</t></is></c>`)).join('') + '</row>').join('');
  return zip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pedido" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${celdas}</sheetData></worksheet>`,
  });
}

// ---------- correo .eml ----------
export function eml({ id, de, para = 'pedidos@ada-demo.test', asunto, texto, adjuntos = [], fecha = 'Mon, 26 Oct 2026 09:15:00 +0100' }) {
  const b = 'ada-limite-' + id;
  const cab = [`Message-ID: <${id}@banco.test>`, `From: ${de}`, `To: ${para}`, `Subject: =?utf-8?B?${Buffer.from(asunto).toString('base64')}?=`, `Date: ${fecha}`, 'MIME-Version: 1.0'];
  const partes = [`--${b}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(texto).toString('base64')}`];
  for (const a of adjuntos) {
    partes.push(`--${b}\r\nContent-Type: ${a.tipo}; name="${a.nombre}"\r\nContent-Disposition: attachment; filename="${a.nombre}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${a.datos.toString('base64').replace(/.{76}/g, '$&\r\n')}`);
  }
  return [...cab, `Content-Type: multipart/mixed; boundary="${b}"`, '', ...partes, `--${b}--`, ''].join('\r\n');
}

const PDF = 'application/pdf';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Lo que debe salir de cada uno está en test/banco.test.js.
export const CORREOS = [
  { archivo: '01-pedido-en-el-texto.eml', id: 'b01', de: 'Marta Ruiz <compras@distribuciones-levante.test>', asunto: 'Pedido 2026-0381 entrega semana 45',
    texto: 'Buenos días,\n\nOs paso el pedido nº 2026-0381.\n\nCL-4471    Tornillo M8x40 zincado    2.000\nCL-4480    Arandela M8               2.000\n\nEntregar en: Almacén de Elche, Polígono Carrús\nEntrega semana 45\n\nGracias,\nMarta' },
  { archivo: '02-pedido-pdf.eml', id: 'b02', de: 'Compras Ferretería Sol <pedidos@ferreteria-sol.test>', asunto: 'Pedido de compra PO-77812',
    texto: 'Adjuntamos orden de compra. Un saludo.',
    adjuntos: [{ nombre: 'PO-77812.pdf', tipo: PDF, datos: pdfTexto(['FERRETERIA SOL SL', 'ORDEN DE COMPRA PO-77812', 'Fecha de entrega: 12/11/2026', '', 'Referencia    Descripcion              Cantidad    Precio', 'TOR-M6-30     Tornillo M6x30           500         0,08', 'TUE-M6        Tuerca M6                500         0,03', 'ARA-M6        Arandela M6              1.000       0,02', '', 'Direccion de entrega: Calle Mayor 3, Alicante']) }] },
  { archivo: '03-pedido-excel.eml', id: 'b03', de: 'Lucia Gomez <lucia@talleres-noray.test>', asunto: 'Pedido semana 46',
    texto: 'Hola, os mando el pedido en Excel. Pedido nº TN-2209.',
    adjuntos: [{ nombre: 'pedido_TN-2209.xlsx', tipo: XLSX, datos: xlsx([['Referencia', 'Descripción', 'Cantidad'], ['NOR-118', 'Bisagra acero 80mm', 240], ['NOR-120', 'Bisagra acero 100mm', 120]]) }] },
  { archivo: '04-factura.eml', id: 'b04', de: 'Administración <admin@ferreteria-sol.test>', asunto: 'Factura F-2026-554',
    texto: 'Adjuntamos la factura del mes de octubre.', adjuntos: [{ nombre: 'F-2026-554.pdf', tipo: PDF, datos: pdfTexto(['FACTURA F-2026-554', 'Total: 1.234,50 EUR']) }] },
  { archivo: '05-reenviado-duplicado.eml', id: 'b05', de: 'Marta Ruiz <compras@distribuciones-levante.test>', asunto: 'RV: Pedido 2026-0381 entrega semana 45',
    texto: 'Os lo reenvío por si no os llegó.\n\nPedido nº 2026-0381\nCL-4471    Tornillo M8x40 zincado    2.000\nCL-4480    Arandela M8               2.000' },
  { archivo: '06-remitente-desconocido.eml', id: 'b06', de: 'Pedro <pedro@empresa-nueva.test>', asunto: 'Pedido urgente 5521',
    texto: 'Necesitamos:\nTOR-M8-40   Tornillo M8x40   300\nPedido 5521' },
  { archivo: '07-pdf-escaneado.eml', id: 'b07', de: 'Compras Ferretería Sol <pedidos@ferreteria-sol.test>', asunto: 'Pedido de compra PO-77813',
    texto: 'Va escaneado, perdonad.', adjuntos: [{ nombre: 'PO-77813.pdf', tipo: PDF, datos: pdfEscaneado() }] },
  { archivo: '08-consulta.eml', id: 'b08', de: 'Lucia Gomez <lucia@talleres-noray.test>', asunto: '¿Tenéis stock?',
    texto: '¿Tenéis unidades de la referencia NOR-118 para la semana que viene? Si es así os haría un pedido.' },
];

export const ESPACIO = {
  nombre: 'Empresa demo (inventada)',
  clientes: [
    { id: 'levante', nombre: 'Distribuciones Levante SL', dominios: ['distribuciones-levante.test'] },
    { id: 'sol', nombre: 'Ferretería Sol SL', dominios: ['ferreteria-sol.test'] },
    { id: 'noray', nombre: 'Talleres Noray SL', dominios: ['talleres-noray.test'] },
  ],
  catalogo: [
    { ref: 'TOR-M8-40', nombre: 'Tornillo M8x40 zincado' }, { ref: 'ARA-M8', nombre: 'Arandela M8' },
    { ref: 'TOR-M6-30', nombre: 'Tornillo M6x30' }, { ref: 'TUE-M6', nombre: 'Tuerca M6' }, { ref: 'ARA-M6', nombre: 'Arandela M6' },
    { ref: 'BIS-80', nombre: 'Bisagra acero 80 mm' }, { ref: 'BIS-100', nombre: 'Bisagra acero 100 mm' },
  ],
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(DIR, { recursive: true });
  for (const c of CORREOS) fs.writeFileSync(path.join(DIR, c.archivo), eml(c));
  fs.writeFileSync(path.join(DIR, '..', 'espacio.json'), JSON.stringify(ESPACIO, null, 2));
  console.log(`${CORREOS.length} correos en ${DIR}`);
}
