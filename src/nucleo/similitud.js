// Parecido entre textos, sin IA y sin dependencias: para cruzar la referencia o la descripción del cliente con el catálogo.
// Da una puntuación de 0 a 1. Por defecto solo se PROPONE (la persona confirma con un clic): una letra distinta
// puede ser otro producto (M6 frente a M8), así que pasar solo por parecido es una opción del espacio, no lo normal.

export function normalizar(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Distancia de edición (Levenshtein) convertida en parecido 0..1. */
export function parecidoEdicion(a, b) {
  a = normalizar(a).replace(/ /g, ''); b = normalizar(b).replace(/ /g, '');
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

const trigramas = (t) => { const s = `  ${normalizar(t)} `; const g = new Map(); for (let i = 0; i < s.length - 2; i++) { const k = s.slice(i, i + 3); g.set(k, (g.get(k) || 0) + 1); } return g; };
/** Coeficiente de Dice sobre trigramas: aguanta palabras cambiadas de orden («Tornillo M8x40 zincado» / «zincado tornillo M8 x 40»). */
export function parecidoTrigramas(a, b) {
  const A = trigramas(a), B = trigramas(b);
  let comun = 0, na = 0, nb = 0;
  for (const v of A.values()) na += v;
  for (const v of B.values()) nb += v;
  for (const [k, v] of A) comun += Math.min(v, B.get(k) || 0);
  return na + nb ? (2 * comun) / (na + nb) : 0;
}

/**
 * Busca en el catálogo lo que más se parece a una línea del cliente.
 * @returns {{ ref, nombre, puntuacion, por, segundo } | null}  por: 'referencia' | 'descripcion'
 */
export function buscarParecido(linea, catalogo) {
  const res = [];
  for (const p of catalogo || []) {
    const r = parecidoEdicion(linea.ref, p.ref);
    const d = linea.descripcion && p.nombre ? parecidoTrigramas(linea.descripcion, p.nombre) * 0.95 : 0;
    res.push({ ref: p.ref, nombre: p.nombre || '', puntuacion: Math.max(r, d), por: r >= d ? 'referencia' : 'descripcion' });
  }
  res.sort((x, y) => y.puntuacion - x.puntuacion);
  if (!res.length) return null;
  return { ...res[0], puntuacion: Math.round(res[0].puntuacion * 1000) / 1000, segundo: res[1] ? Math.round(res[1].puntuacion * 1000) / 1000 : 0 };
}
