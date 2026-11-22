// Destino Holded: POST /api/invoicing/v1/documents/salesorder con la clave en la cabecera «key».
// https://developers.holded.com · El contacto del cliente: config.clientes[].ids.holded (id de contacto de Holded).
// Ojo: Holded anunció una API v2 (mayo 2026); la v1 sigue para integraciones existentes. Confirmar al activar.
import { pedirJson, secreto, idEn, fechaIso, FalloDestino } from './comun.js';

export function crearHolded(cfg, { fetchFn = fetch, env = process.env } = {}) {
  const base = String(cfg.url || 'https://api.holded.com').replace(/\/$/, '');
  return {
    nombre: 'holded',
    async registrar(exp, _plantilla, config = {}) {
      const d = exp.datos || {};
      const contacto = idEn(config.clientes, 'id', exp.cliente && exp.cliente.id, 'holded');
      if (!contacto) throw new FalloDestino(`Holded: el cliente ${exp.cliente ? exp.cliente.nombre : '¿?'} no tiene ids.holded en la config`);
      const entrega = fechaIso(d.fecha_entrega);
      const cuerpo = {
        contactId: contacto,
        date: Math.floor(Date.parse(exp.recibido) / 1000),
        ...(entrega ? { dueDate: Math.floor(Date.parse(entrega) / 1000) } : {}),
        notes: [d.numero_pedido && `Pedido del cliente ${d.numero_pedido}`, d.direccion_entrega && `Entregar en ${d.direccion_entrega}`].filter(Boolean).join(' · '),
        items: (d.lineas || []).map((l) => {
          const prod = (config.catalogo || []).find((p) => p.ref === l.producto) || {};
          return { name: prod.nombre || l.descripcion || l.producto, sku: idEn(config.catalogo, 'ref', l.producto, 'holded') ?? l.producto, units: l.cantidad, ...(l.precio != null ? { subtotal: l.precio } : {}) };
        }),
      };
      const j = await pedirJson(fetchFn, `${base}/api/invoicing/v1/documents/salesorder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', key: secreto(cfg, 'clave', env) }, body: JSON.stringify(cuerpo),
      }, 'Holded');
      return { referencia: j && (j.id || j.docNumber) ? String(j.docNumber || j.id) : exp.id.slice(0, 8) };
    },
  };
}
