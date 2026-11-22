// Tablero de proceso: dónde se va el tiempo y dónde se atasca el trabajo, a partir del historial de los expedientes.
// Es process mining sencillo y sin dependencias. Para análisis más finos, el mismo historial sale en OCEL 2.0 (ocel.js)
// y se abre con PM4Py.
import { percentil } from './metricas.js';

const ms = (f) => Date.parse(f);
const min = (x) => (x == null ? null : Math.round((x / 60000) * 10) / 10);
const ABIERTOS = new Set(['en_curso', 'por_revisar', 'incidencia']);

/**
 * @param {object[]} expedientes
 * @param {object} [o] { ahora: ms, nombres: { puesto: 'Nombre' } }
 * @returns {{ puestos, transiciones, cuello, retrabajo, abiertos }}
 */
export function procesoDe(expedientes, { ahora = Date.now(), nombres = {} } = {}) {
  const estancias = {}; // puesto → [ms]
  const trans = new Map(); // 'a→b' → [ms]
  let retrabajo = 0;
  for (const e of expedientes) {
    const h = [...(e.historial || [])].sort((a, b) => ms(a.fecha) - ms(b.fecha));
    // tramos seguidos en el mismo puesto = una estancia
    const tramos = [];
    for (const x of h) {
      if (x.que === 'corregido' || x.que === 'reintento') retrabajo += 1;
      const ult = tramos[tramos.length - 1];
      if (ult && ult.puesto === x.puesto) ult.fin = ms(x.fecha);
      else tramos.push({ puesto: x.puesto, ini: ms(x.fecha), fin: ms(x.fecha) });
    }
    for (let i = 0; i < tramos.length; i++) {
      const t = tramos[i], sig = tramos[i + 1];
      const fin = sig ? sig.ini : (ABIERTOS.has(e.estado) ? ahora : t.fin);
      (estancias[t.puesto] ||= []).push(fin - t.ini);
      if (sig) { const k = `${t.puesto}→${sig.puesto}`; if (!trans.has(k)) trans.set(k, []); trans.get(k).push(sig.ini - t.ini); }
    }
  }
  const abiertos = expedientes.filter((e) => ABIERTOS.has(e.estado));
  const total = Object.values(estancias).flat().reduce((s, x) => s + x, 0) || 1;
  const puestos = Object.entries(estancias).map(([id, v]) => {
    const enCola = abiertos.filter((e) => e.puesto === id);
    const masVieja = enCola.length ? Math.max(...enCola.map((e) => ahora - ms(e.actualizado || e.recibido))) : null;
    const suma = v.reduce((s, x) => s + x, 0);
    return {
      id, nombre: nombres[id] || id, pasos: v.length,
      estancia_min: { p50: min(percentil(v, 0.5)), p90: min(percentil(v, 0.9)), media: min(suma / v.length) },
      parte_del_tiempo_pct: Math.round((suma / total) * 1000) / 10,
      en_cola: enCola.length, espera_mas_larga_min: min(masVieja),
    };
  }).sort((a, b) => b.parte_del_tiempo_pct - a.parte_del_tiempo_pct);
  const transiciones = [...trans.entries()].map(([k, v]) => { const [de, a] = k.split('→'); return { de, a, veces: v.length, p50_min: min(percentil(v, 0.5)) }; })
    .sort((x, y) => y.veces - x.veces);
  const cuello = puestos.find((p) => p.id !== 'seguimiento') || null;
  return { puestos, transiciones, cuello: cuello && { id: cuello.id, nombre: cuello.nombre, parte_del_tiempo_pct: cuello.parte_del_tiempo_pct }, retrabajo, abiertos: abiertos.length };
}
