// Destino Sindri (nuestro ERP): API de integraciones con llave «sdi_…» (Authorization: Bearer).
// La ruta de alta de pedidos es configurable porque la API de integraciones de Sindri aún no la publica
// (ver docs/apps/sindri en DESARROLLO). Idempotency-Key = id del expediente: reintentar no duplica.
import { pedirJson, secreto, idEn, fechaIso, FalloDestino } from './comun.js';

export function crearSindri(cfg, { fetchFn = fetch, env = process.env } = {}) {
  const base = String(cfg.url || '').replace(/\/$/, '');
  const ruta = cfg.ruta || '/sindri/api/integracion/v1/pedidos';
  return {
    nombre: 'sindri',
    async registrar(exp, _plantilla, config = {}) {
      if (!base) throw new FalloDestino('Sindri: falta la url en la config del destino');
      const d = exp.datos || {};
      const cuerpo = {
        origen: 'ada', expediente: exp.id,
        cliente: idEn(config.clientes, 'id', exp.cliente && exp.cliente.id, 'sindri') ?? (exp.cliente && exp.cliente.id),
        numero_pedido_cliente: d.numero_pedido || null,
        fecha_entrega: fechaIso(d.fecha_entrega) || d.fecha_entrega || null,
        direccion_entrega: d.direccion_entrega || null,
        lineas: (d.lineas || []).map((l) => ({ producto: idEn(config.catalogo, 'ref', l.producto, 'sindri') ?? l.producto, cantidad: l.cantidad, precio: l.precio ?? null, ref_cliente: l.ref })),
      };
      const j = await pedirJson(fetchFn, base + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secreto(cfg, 'llave', env)}`, 'Idempotency-Key': exp.id },
        body: JSON.stringify(cuerpo),
      }, 'Sindri');
      return { referencia: (j && (j.numero || j.id || j.referencia)) ? String(j.numero || j.id || j.referencia) : exp.id.slice(0, 8) };
    },
  };
}
