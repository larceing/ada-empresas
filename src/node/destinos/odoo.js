// Destino Odoo: JSON-RPC (/jsonrpc) con usuario y clave de API. Crea un sale.order con sus líneas.
// El producto se busca por referencia interna (default_code) si no viene en config.catalogo[].ids.odoo,
// y el cliente por config.clientes[].ids.odoo (id de res.partner).
import { pedirJson, secreto, idEn, fechaIso, FalloDestino } from './comun.js';

export function crearOdoo(cfg, { fetchFn = fetch, env = process.env } = {}) {
  const base = String(cfg.url || '').replace(/\/$/, '');
  let uid = null;
  let n = 0;
  async function rpc(service, method, args) {
    n += 1;
    const j = await pedirJson(fetchFn, `${base}/jsonrpc`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: n, params: { service, method, args } }),
    }, 'Odoo');
    if (j && j.error) throw new FalloDestino(`Odoo: ${(j.error.data && j.error.data.message) || j.error.message}`);
    return j && j.result;
  }
  return {
    nombre: 'odoo',
    async registrar(exp, _plantilla, config = {}) {
      if (!base || !cfg.base_datos || !cfg.usuario) throw new FalloDestino('Odoo: faltan url, base_datos o usuario en la config');
      const clave = secreto(cfg, 'clave', env);
      if (!uid) { uid = await rpc('common', 'login', [cfg.base_datos, cfg.usuario, clave]); if (!uid) throw new FalloDestino('Odoo: usuario o clave no válidos'); }
      const llamar = (modelo, metodo, a, kw = {}) => rpc('object', 'execute_kw', [cfg.base_datos, uid, clave, modelo, metodo, a, kw]);
      const d = exp.datos || {};
      const partner = idEn(config.clientes, 'id', exp.cliente && exp.cliente.id, 'odoo');
      if (!partner) throw new FalloDestino(`Odoo: el cliente ${exp.cliente ? exp.cliente.nombre : '¿?'} no tiene ids.odoo en la config`);
      const lineas = [];
      for (const l of d.lineas || []) {
        let pid = idEn(config.catalogo, 'ref', l.producto, 'odoo');
        if (!pid) {
          const r = await llamar('product.product', 'search', [[['default_code', '=', l.producto]]], { limit: 1 });
          pid = r && r[0];
        }
        if (!pid) throw new FalloDestino(`Odoo: no encuentro el producto ${l.producto}`);
        lineas.push([0, 0, { product_id: pid, product_uom_qty: l.cantidad, ...(l.precio != null ? { price_unit: l.precio } : {}) }]);
      }
      const entrega = fechaIso(d.fecha_entrega);
      const id = await llamar('sale.order', 'create', [{ partner_id: partner, client_order_ref: d.numero_pedido || false, ...(entrega ? { commitment_date: `${entrega} 00:00:00` } : {}), order_line: lineas, note: `Desde Ada · expediente ${exp.id}` }]);
      return { referencia: `sale.order/${id}` };
    },
  };
}
