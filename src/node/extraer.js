// Paso 3 (parte gratis): sacar texto de los adjuntos en el propio servidor.
// PDF con texto → pdftotext. PDF escaneado → OCR (pdftoppm + tesseract) si están instalados.
// Excel (.xlsx) → lectura del zip sin dependencias. CSV y TXT tal cual.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

function hay(cmd) {
  try { execFileSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }); return true; } catch { return false; }
}

function conTemporal(datos, ext, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ada-'));
  const f = path.join(dir, 'doc' + ext);
  fs.writeFileSync(f, datos);
  try { return fn(f, dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function textoPdf(datos) {
  if (!hay('pdftotext')) return { texto: '', metodo: 'sin-pdftotext', aviso: 'Falta pdftotext en el servidor' };
  const texto = conTemporal(datos, '.pdf', (f) => execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', f, '-'], { maxBuffer: 20e6, timeout: 30e3 }).toString('utf8'));
  if (texto.replace(/\s/g, '').length >= 20) return { texto, metodo: 'pdf-texto' };
  // Sin texto: es un escaneado.
  if (!hay('pdftoppm') || !hay('tesseract')) return { texto: '', metodo: 'escaneado', aviso: 'PDF escaneado y no hay OCR instalado' };
  const ocr = conTemporal(datos, '.pdf', (f, dir) => {
    execFileSync('pdftoppm', ['-r', '300', '-png', '-l', '5', f, path.join(dir, 'p')], { timeout: 60e3 });
    return fs.readdirSync(dir).filter((n) => n.endsWith('.png')).sort()
      .map((n) => execFileSync('tesseract', [path.join(dir, n), '-', '-l', 'spa+eng'], { maxBuffer: 20e6, timeout: 60e3 }).toString('utf8'))
      .join('\n');
  });
  return { texto: ocr, metodo: 'ocr' };
}

// ---- .xlsx: un zip con XML dentro ----
function leerZip(buf) {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) throw new Error('No es un zip');
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const archivos = {};
  for (let i = 0; i < total; i++) {
    const metodo = buf.readUInt16LE(p + 10);
    const tam = buf.readUInt32LE(p + 20);
    const ln = buf.readUInt16LE(p + 28), le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + ln);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const crudo = buf.subarray(inicio, inicio + tam);
    archivos[nombre] = () => (metodo === 8 ? zlib.inflateRawSync(crudo) : crudo);
    p += 46 + ln + le + lc;
  }
  return archivos;
}

const desXml = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function textoXlsx(datos) {
  const z = leerZip(datos);
  const compartidas = z['xl/sharedStrings.xml']
    ? [...z['xl/sharedStrings.xml']().toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => desXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))
    : [];
  const hojas = Object.keys(z).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  const lineas = [];
  for (const h of hojas) {
    const xml = z[h]().toString('utf8');
    for (const fila of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const celdas = [...fila[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
        const attrs = c[1] || '', dentro = c[2] || '';
        const v = (/<v>([\s\S]*?)<\/v>/.exec(dentro) || [])[1];
        if (/t="s"/.test(attrs)) return compartidas[Number(v)] ?? '';
        if (/t="inlineStr"/.test(attrs)) return desXml(((/<t[^>]*>([\s\S]*?)<\/t>/.exec(dentro) || [])[1]) || '');
        return v !== undefined ? desXml(v) : '';
      });
      if (celdas.some((x) => String(x).trim())) lineas.push(celdas.join('\t'));
    }
  }
  return { texto: lineas.join('\n'), metodo: 'excel' };
}

export function leerAdjunto(adj) {
  const n = String(adj.nombre || '').toLowerCase();
  const tipo = String(adj.tipo || '');
  try {
    if (n.endsWith('.pdf') || tipo === 'application/pdf') return textoPdf(adj.datos);
    if (n.endsWith('.xlsx')) return textoXlsx(adj.datos);
    if (/\.(csv|txt)$/.test(n) || tipo.startsWith('text/')) return { texto: Buffer.from(adj.datos).toString('utf8'), metodo: 'texto' };
    return { texto: '', metodo: 'ignorado' };
  } catch (e) {
    return { texto: '', metodo: 'error', aviso: `No se pudo leer: ${e.message}` };
  }
}

export { textoXlsx, leerZip };
