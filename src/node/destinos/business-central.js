// Destino Microsoft Dynamics 365 Business Central: API v2.0, salesOrders con sus líneas en una sola llamada (deep insert).
// https://learn.microsoft.com/dynamics365/business-central/dev-itpro/api-reference/v2.0/resources/dynamics_salesorder
// El token OAuth (Entra ID, credenciales de cliente) lo da obtenerToken(); por defecto se pide con client_id/secret del entorno.
import { pedirJson, secreto, idEn, fechaIso, FalloDestino } from './comun.js';

export function crearBusinessCentral(cfg, { fetchFn = fetch, env = process.env, obtenerToken } = {}) {
  const { tenant, entorno = 'production', empresa } = cfg;
  const base = cfg.url || `https://api.businesscentral.dynamics.com/v2.0/${tenant}/${entorno}/api/v2.0`;
  let token = null, caduca = 0;
  async function tokenPorDefecto() {
    if (token && Date.now() < caduca - 60e3) return token;
    const cuerpo = new URLSearchParams({ grant_type: 'client_credentials', client_id: cfg.cliente_id, client_secret: secreto(cfg, 'secreto_cliente', env), scope: 'https://api.businesscentral.dynamics.com/.default' });
    const j = await pedirJson(fetchFn, `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo.toString() }, 'Business Central (token)');
    token = j.access_token; caduca = Date.now() + (j.expires_in || 3600) * 1000;
    return token;
  }
  return {
    nombre: 'business-central',
    async registrar(exp, _plantilla, config = {}) {
      if (!empresa || (!cfg.url && !tenant)) throw new FalloDestino('Business Central: faltan tenant y empresa en la config');
      const d = exp.datos || {};
      const cliente = idEn(config.clientes, 'id', exp.cliente && exp.cliente.id, 'bc');
      if (!cliente) throw new FalloDestino(`Business Central: el cliente ${exp.cliente ? exp.cliente.nombre : '¿?'} no tiene ids.bc (número de cliente)`);
      const entrega = fechaIso(d.fecha_entrega);
      const cuerpo = {
        customerNumber: cliente,
        externalDocumentNumber: d.numero_pedido || '',
        ...(entrega ? { requestedDeliveryDate: entrega } : {}),
        salesOrderLines: (d.lineas || []).map((l) => ({ lineType: 'Item', lineObjectNumber: idEn(config.catalogo, 'ref', l.producto, 'bc') ?? l.producto, quantity: l.cantidad, ...(l.precio != null ? { unitPrice: l.precio } : {}) })),
      };
      const t = obtenerToken ? await obtenerToken() : await tokenPorDefecto();
      const j = await pedirJson(fetchFn, `${base}/companies(${empresa})/salesOrders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(cuerpo) }, 'Business Central');
      return { referencia: j && (j.number || j.id) ? String(j.number || j.id) : exp.id.slice(0, 8) };
    },
  };
}
