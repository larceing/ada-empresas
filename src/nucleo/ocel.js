// Exportar lo que pasa en las oficinas en OCEL 2.0 (JSON), el estándar abierto de registros de eventos
// «centrados en objetos» (RWTH Aachen, https://www.ocel-standard.org). Lo lee PM4Py (pm4py.read_ocel2_json)
// y las herramientas de process mining. Cada paso del historial es un evento; los objetos son el expediente
// (pedido, orden…), el cliente y los productos. Si un expediente nació de otro (Pedidos → Producción), se enlazan.

const tipoValor = (v) => (typeof v === 'number' ? 'float' : 'string');

/**
 * @param {object[]} expedientes  de una o varias oficinas (cada uno lleva `oficina` y `tipo`)
 * @param {object} [o] { nombresOficina: { pedidos: 'Pedidos' } }
 */
export function aOcel(expedientes, { nombresOficina = {} } = {}) {
  const objetos = new Map();
  const eventos = [];
  const tiposObjeto = new Map(); // nombre → Map(atributo → tipo)
  const tiposEvento = new Set();
  const porClave = new Map(expedientes.filter((e) => e.id).map((e) => [e.id, e]));

  function objeto(id, tipo, atributos = {}, fecha) {
    if (!tiposObjeto.has(tipo)) tiposObjeto.set(tipo, new Map());
    const at = tiposObjeto.get(tipo);
    let o = objetos.get(id);
    if (!o) { o = { id, type: tipo, attributes: [], relationships: [] }; objetos.set(id, o); }
    for (const [k, v] of Object.entries(atributos)) {
      if (v === null || v === undefined) continue;
      if (!at.has(k)) at.set(k, tipoValor(v));
      if (!o.attributes.some((a) => a.name === k && a.value === v)) o.attributes.push({ name: k, time: fecha || '1970-01-01T00:00:00.000Z', value: v });
    }
    return o;
  }
  const enlazar = (o, objectId, qualifier) => { if (!o.relationships.some((r) => r.objectId === objectId && r.qualifier === qualifier)) o.relationships.push({ objectId, qualifier }); };

  for (const e of expedientes) {
    const idExp = `${e.tipo || 'caso'}:${e.id}`;
    const ultima = e.actualizado || e.recibido;
    const ox = objeto(idExp, e.tipo || 'caso', {
      oficina: e.oficina, estado: e.estado,
      numero: e.datos && (e.datos.numero_pedido || e.datos.numero) || null,
      correcciones: e.correcciones || 0,
    }, ultima);
    const rel = [{ objectId: idExp, qualifier: 'expediente' }];
    if (e.cliente && e.cliente.id) {
      const idCl = `cliente:${e.cliente.id}`;
      objeto(idCl, 'cliente', { nombre: e.cliente.nombre }, e.recibido);
      enlazar(ox, idCl, 'de');
      rel.push({ objectId: idCl, qualifier: 'cliente' });
    }
    const productos = [...new Set(((e.datos && e.datos.lineas) || []).map((l) => l.producto).filter(Boolean))];
    for (const p of productos) { objeto(`producto:${p}`, 'producto', { ref: p }); enlazar(ox, `producto:${p}`, 'contiene'); }
    // ¿Nació de otro expediente? La clave es «<evento>:<id>», p. ej. «pedidos.registrado:abc-0001»
    const m = /^[a-z0-9_-]+\.[a-z0-9_]+:(.+)$/i.exec(e.clave || '');
    if (m && porClave.has(m[1])) { const o = porClave.get(m[1]); enlazar(ox, `${o.tipo || 'caso'}:${o.id}`, 'viene de'); }

    (e.historial || []).forEach((h, i) => {
      const tipo = `${h.puesto} · ${h.que}`;
      tiposEvento.add(tipo);
      const r = [...rel];
      if (['extraído', 'registrado', 'aprobado'].includes(h.que)) for (const p of productos) r.push({ objectId: `producto:${p}`, qualifier: 'producto' });
      eventos.push({
        id: `${e.id}:${i}`, type: tipo, time: h.fecha,
        attributes: [
          { name: 'oficina', value: nombresOficina[e.oficina] || e.oficina || '' },
          { name: 'puesto', value: h.puesto }, { name: 'quien', value: h.quien || '' },
          ...(h.detalle ? [{ name: 'detalle', value: String(h.detalle) }] : []),
        ],
        relationships: r,
      });
    });
  }
  eventos.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const atributosEvento = ['oficina', 'puesto', 'quien', 'detalle'].map((name) => ({ name, type: 'string' }));
  return {
    objectTypes: [...tiposObjeto.entries()].map(([name, at]) => ({ name, attributes: [...at.entries()].map(([n, type]) => ({ name: n, type })) })),
    eventTypes: [...tiposEvento].sort().map((name) => ({ name, attributes: atributosEvento })),
    objects: [...objetos.values()],
    events: eventos,
  };
}
