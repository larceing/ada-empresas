// Almacén en ficheros: /datos/<espacio>/<oficina>/. Misma forma que nucleo/memoria.js.
// JSON con escritura atómica: suficiente para el prototipo; se cambia por PostgreSQL sin tocar el núcleo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function crearAlmacen(raiz, espacio, oficina) {
  if (!ID.test(espacio) || !ID.test(oficina)) throw new Error('Nombre de espacio u oficina no válido');
  const dirEspacio = path.join(raiz, espacio);
  const dir = path.join(dirEspacio, oficina);
  fs.mkdirSync(dir, { recursive: true });
  const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
  const escribir = (f, v) => { const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(v, null, 2), { mode: 0o600 }); fs.renameSync(t, f); };
  const fExp = path.join(dir, 'expedientes.json');
  const fCfg = path.join(dir, 'config.json');
  const fEspacio = path.join(dirEspacio, 'espacio.json'); // clientes y catálogo, comunes a todas las oficinas
  const fEq = path.join(dir, 'equivalencias.json');
  const fGasto = path.join(dirEspacio, 'gasto_ia.json');
  const exps = () => leer(fExp, []);
  const mes = () => new Date().toISOString().slice(0, 7);
  return {
    async config() { return { clientes: [], catalogo: [], automatico: [], tope_ia_usd: 5, ...leer(fEspacio, {}), ...leer(fCfg, {}) }; },
    async guardarConfig(c) { escribir(fCfg, c); },
    async guardarEspacio(c) { escribir(fEspacio, c); },
    nuevoId: () => crypto.randomUUID(),
    async guardar(e) { const t = exps(); const i = t.findIndex((x) => x.id === e.id); if (i >= 0) t[i] = e; else t.push(e); escribir(fExp, t); },
    async obtener(id) { return exps().find((x) => x.id === id) || null; },
    async listar() { return exps(); },
    async visto(clave) { return exps().some((x) => x.clave === clave); },
    async existe(filtro) { return exps().some(filtro); },
    async equivalencia(cliente, ref) { return (leer(fEq, {})[cliente] || {})[String(ref).toUpperCase()] || null; },
    async aprender(cliente, ref, valor) { const eq = leer(fEq, {}); eq[cliente] = { ...(eq[cliente] || {}), [String(ref).toUpperCase()]: valor }; escribir(fEq, eq); },
    async gastoMes() { return leer(fGasto, {})[mes()] || 0; },
    async sumarGasto(usd) { const g = leer(fGasto, {}); g[mes()] = Math.round(((g[mes()] || 0) + usd) * 1e6) / 1e6; escribir(fGasto, g); },
  };
}
