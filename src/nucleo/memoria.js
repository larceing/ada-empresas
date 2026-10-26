// Almacén en memoria: para el laboratorio (navegador) y las pruebas. Misma forma que node/almacen.js.
export function crearMemoria(config = {}) {
  let cfg = { clientes: [], catalogo: [], automatico: [], tope_ia_usd: 5, ...config };
  const exps = new Map();
  const equivalencias = {};
  let n = 0;
  const copia = (x) => JSON.parse(JSON.stringify(x));
  return {
    async config() { return copia(cfg); },
    async guardarConfig(c) { cfg = copia(c); },
    nuevoId() {
      n += 1;
      const r = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
      return `${r}-${String(n).padStart(4, '0')}`;
    },
    async guardar(e) { exps.set(e.id, copia(e)); },
    async obtener(id) { return exps.has(id) ? copia(exps.get(id)) : null; },
    async listar() { return [...exps.values()].map(copia); },
    async visto(clave) { return [...exps.values()].some((e) => e.clave === clave); },
    async existe(filtro) { return [...exps.values()].some((e) => filtro(e)); },
    async equivalencia(cliente, ref) { return (equivalencias[cliente] || {})[String(ref).toUpperCase()] || null; },
    async aprender(cliente, ref, valor) { equivalencias[cliente] = { ...(equivalencias[cliente] || {}), [String(ref).toUpperCase()]: valor }; },
  };
}
