// Lo común a todos los destinos (ERPs): llamar por HTTP con tiempo máximo y convertir los fallos
// en incidencias claras («destino»), que la oficina deja en Incidencias para reintentar.
export class FalloDestino extends Error {
  constructor(mensaje, extra = {}) { super(mensaje); this.tipo = 'destino'; Object.assign(this, extra); }
}

export async function pedirJson(fetchFn, url, opciones, que) {
  let r;
  try {
    r = await fetchFn(url, { ...opciones, signal: AbortSignal.timeout(opciones.tiempo || 30e3) });
  } catch (e) { throw new FalloDestino(`${que}: no responde (${e.message})`); }
  const texto = await r.text();
  let j = null;
  try { j = texto ? JSON.parse(texto) : null; } catch { /* algunos devuelven texto */ }
  if (!r.ok) throw new FalloDestino(`${que} respondió ${r.status}${j && (j.error || j.message) ? `: ${typeof (j.error || j.message) === 'string' ? (j.error || j.message) : JSON.stringify(j.error || j.message)}` : ''}`, { estado: r.status });
  return j;
}

/** Código del cliente o del producto en ese ERP: config.clientes[].ids.<erp>, config.catalogo[].ids.<erp>; si no, el propio id/ref. */
export const idEn = (lista, clave, valor, erp) => {
  const x = (lista || []).find((y) => y[clave] === valor);
  return (x && x.ids && x.ids[erp]) ?? null;
};

/** El secreto nunca va en la config: la config dice en qué variable de entorno está. */
export function secreto(cfg, campo, env = process.env) {
  const nombre = cfg[`${campo}_env`];
  const v = nombre ? env[nombre] : undefined;
  if (!v) throw new FalloDestino(`Falta el secreto ${campo}: pon la variable de entorno ${nombre || `${campo}_env en la config`}`);
  return v;
}

/** Fecha de entrega del pedido (dd/mm/aaaa o semana N) a ISO aaaa-mm-dd, si se puede. */
export function fechaIso(t) {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(String(t || '').trim());
  if (!m) return null;
  const a = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
