// Lee un correo en formato .eml (RFC 822 / MIME) sin dependencias.
// Devuelve la «entrada» de una oficina: { canal, message_id, de, de_nombre, para, asunto, fecha, texto, adjuntos: [{ nombre, tipo, datos }] }.

function partirCabeceras(bruto) {
  const corte = bruto.search(/\r?\n\r?\n/);
  const cab = corte < 0 ? bruto : bruto.slice(0, corte);
  const cuerpo = corte < 0 ? '' : bruto.slice(corte).replace(/^\r?\n\r?\n/, '');
  const cabeceras = {};
  for (const linea of cab.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = linea.indexOf(':');
    if (i > 0) cabeceras[linea.slice(0, i).trim().toLowerCase()] = linea.slice(i + 1).trim();
  }
  return { cabeceras, cuerpo };
}

// =?utf-8?B?...?= y =?utf-8?Q?...?=
function decodificarPalabras(t) {
  return String(t || '').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, modo, txt) => {
    const buf = modo.toUpperCase() === 'B'
      ? Buffer.from(txt, 'base64')
      : Buffer.from(txt.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
    return aTexto(buf, cs);
  });
}

function aTexto(buf, charset) {
  const cs = String(charset || 'utf-8').toLowerCase();
  if (cs.includes('8859') || cs.includes('latin') || cs.includes('1252')) return buf.toString('latin1');
  return buf.toString('utf8');
}

function parametro(valor, nombre) {
  const m = new RegExp(nombre + '\\*?=("([^"]*)"|[^;\\s]+)', 'i').exec(valor || '');
  if (!m) return '';
  let v = m[2] !== undefined ? m[2] : m[1];
  if (/^utf-8''/i.test(v)) v = decodeURIComponent(v.replace(/^utf-8''/i, ''));
  return decodificarPalabras(v);
}

function decodificarCuerpo(cuerpo, cte) {
  const c = String(cte || '').toLowerCase();
  if (c === 'base64') return Buffer.from(cuerpo.replace(/\s+/g, ''), 'base64');
  if (c === 'quoted-printable') {
    const t = cuerpo.replace(/=\r?\n/g, '');
    const bytes = [];
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.substr(i + 1, 2))) { bytes.push(parseInt(t.substr(i + 1, 2), 16)); i += 2; }
      else bytes.push(t.charCodeAt(i) & 0xff);
    }
    return Buffer.from(bytes);
  }
  return Buffer.from(cuerpo, 'latin1');
}

function recorrer(parte, salida) {
  const { cabeceras, cuerpo } = partirCabeceras(parte);
  const ct = cabeceras['content-type'] || 'text/plain';
  const tipo = ct.split(';')[0].trim().toLowerCase();
  if (tipo.startsWith('multipart/')) {
    const limite = parametro(ct, 'boundary');
    if (!limite) return;
    const trozos = cuerpo.split('--' + limite);
    for (const t of trozos.slice(1)) {
      if (t.startsWith('--')) break;
      recorrer(t.replace(/^\r?\n/, ''), salida);
    }
    return;
  }
  const disp = cabeceras['content-disposition'] || '';
  const nombre = parametro(disp, 'filename') || parametro(ct, 'name');
  const datos = decodificarCuerpo(cuerpo, cabeceras['content-transfer-encoding']);
  if (nombre || /attachment/i.test(disp)) {
    salida.adjuntos.push({ nombre: nombre || 'adjunto', tipo, datos });
  } else if (tipo === 'text/plain') {
    salida.textos.push(aTexto(datos, parametro(ct, 'charset')));
  } else if (tipo === 'text/html') {
    salida.htmls.push(aTexto(datos, parametro(ct, 'charset')));
  }
}

function htmlATexto(h) {
  return h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function direccion(t) {
  const m = /<([^>]+)>/.exec(t || '');
  return (m ? m[1] : String(t || '')).trim().toLowerCase();
}

export function leerCorreo(bruto) {
  const texto = Buffer.isBuffer(bruto) ? bruto.toString('latin1') : String(bruto);
  const { cabeceras } = partirCabeceras(texto);
  const salida = { textos: [], htmls: [], adjuntos: [] };
  recorrer(texto, salida);
  return {
    canal: 'correo',
    message_id: (cabeceras['message-id'] || '').replace(/[<>]/g, ''),
    de: direccion(decodificarPalabras(cabeceras.from)),
    de_nombre: decodificarPalabras(cabeceras.from || '').replace(/<[^>]*>/, '').replace(/"/g, '').trim(),
    para: direccion(decodificarPalabras(cabeceras.to)),
    asunto: decodificarPalabras(cabeceras.subject || ''),
    fecha: cabeceras.date ? new Date(cabeceras.date).toISOString() : null,
    texto: salida.textos.join('\n').trim() || htmlATexto(salida.htmls.join('\n')),
    adjuntos: salida.adjuntos,
  };
}

export { htmlATexto };
