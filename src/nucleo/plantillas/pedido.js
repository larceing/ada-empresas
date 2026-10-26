// Plantilla «pedido» (Ada Pedidos, de ada-office): qué es un pedido, qué datos sacar y qué comprobar.
// Las reglas resuelven lo habitual sin gastar; la IA solo entra cuando las reglas no bastan.

export const nombre = 'pedido';
// Si hay oficina Comercial, lo que gana el comercial entra aquí como pedido ya ordenado.
export const escucha = 'comercial.registrado';
export function desdeEvento(_evento, d) {
  return {
    canal: 'Brokkr', de: 'Oficina Comercial', asunto: `Oportunidad ganada · ${d.titulo}`,
    cliente_id: d.cliente ? d.cliente.id : null,
    estructurado: { numero_pedido: `OP-${String(d.id).slice(0, 6).toUpperCase()}`, lineas: d.datos.lineas.map((l) => ({ ref: l.producto, descripcion: '', cantidad: l.cantidad, precio: l.precio ?? null, producto: l.producto })) },
  };
}
export const estadosSeguimiento = ['confirmado', 'en_produccion', 'servido'];
export const puestos = {
  recepcion: { nombre: 'Buzón de pedidos', tarea: 'Lee el correo y sus adjuntos y decide si es un pedido' },
  gestion: { nombre: 'Gestión de pedidos', tarea: 'Saca cliente, número, entrega y líneas, y las cruza con el catálogo' },
  supervision: { nombre: 'Responsable de pedidos', tarea: 'Aprueba, corrige referencias o descarta' },
  registro: { nombre: 'Alta en el ERP', tarea: 'Da de alta el pedido en el ERP' },
  seguimiento: { nombre: 'Atención al cliente', tarea: 'Confirmación al cliente, producción y entrega' },
};

// ---------- números en formato español ----------
export function numero(t) {
  let s = String(t ?? '').trim().replace(/€|\s|uds?\.?$|unidades$/gi, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const textos = (e) => (e.adjuntos || []).map((a) => a.texto || '').filter(Boolean);

// ---------- Recepción ----------
export function identificar(e, c) {
  if (e.cliente_id) { const x = (c.config.clientes || []).find((y) => y.id === e.cliente_id); if (x) return { id: x.id, nombre: x.nombre }; }
  const d = String(e.de || '').toLowerCase();
  const dominio = d.split('@')[1] || '';
  const cl = (c.config.clientes || []).find((x) => (x.correos || []).includes(d) || (x.dominios || []).includes(dominio));
  return cl ? { id: cl.id, nombre: cl.nombre } : null;
}

export function clasificar(e) {
  if (e.estructurado) return { es: true, motivo: `Pedido desde ${e.canal || 'otra oficina'}` };
  const asunto = String(e.asunto || '').toLowerCase();
  const todo = (String(e.texto || '') + '\n' + textos(e).join('\n')).toLowerCase();
  if (/\b(factura|invoice|abono)\b/.test(asunto) && !/\bpedido\b/.test(asunto)) return { es: false, motivo: 'Parece una factura' };
  let puntos = 0;
  const por = [];
  if (/\b(pedido|order|orden de compra|po)\b/.test(asunto)) { puntos += 2; por.push('asunto'); }
  if ((e.adjuntos || []).some((a) => /^(ped|pedido|order|po|oc)[\s_.-]/i.test(a.nombre || ''))) { puntos += 2; por.push('adjunto'); }
  if (/\b(pedido|order|orden de compra)\b/.test(todo)) { puntos += 1; por.push('texto'); }
  if (/\b(cantidad|uds|unidades|qty|referencia|ref\.?)\b/.test(todo)) { puntos += 1; por.push('tabla'); }
  if (puntos >= 3) return { es: true, motivo: 'Pedido (por ' + por.join(', ') + ')' };
  if (puntos >= 1) return { es: 'duda', motivo: 'Puede ser un pedido (' + por.join(', ') + ')' };
  return { es: false, motivo: 'No parece un pedido' };
}

// ---------- Gestión: reglas ----------
const esRef = (t) => /^[A-Z0-9][A-Z0-9._/-]{2,}$/i.test(t) && /\d/.test(t) && /[A-Z]/i.test(t);

// Una línea de pedido: referencia al principio (o tras un nº de línea), números al final (cantidad y, si hay, precio).
// Primero se miran las columnas (tabulador, «;» o varios espacios), que es lo que dan Excel y la mayoría de correos;
// si no hay columnas claras (texto apretado de algunos PDF), se mira palabra a palabra.
const esNum = (t) => numero(t) !== null;
const limpiar = (l) => l.filter((x) => x && !/^(uds?\.?|unidades|eur|€)$/i.test(x));

function deTrozos(t) {
  if (t.length < 2) return null;
  // La referencia puede venir pegada a la descripción en la primera columna («TOR-M6-30 Tornillo M6x30»)
  let iRef = esRef(t[0]) ? 0 : (esNum(t[0]) && t[1] && esRef(t[1]) ? 1 : -1);
  if (iRef < 0) {
    const pal = t[0].split(/\s+/);
    if (pal.length > 1 && esRef(pal[0])) { t = [pal[0], pal.slice(1).join(' '), ...t.slice(1)]; iRef = 0; } else return null;
  }
  let fin = t.length;
  while (fin > iRef + 1 && esNum(t[fin - 1])) fin -= 1;
  const nums = t.slice(fin).map(numero);
  if (!nums.length) return null;
  const cantidad = nums[0];
  if (cantidad <= 0 || cantidad > 1e7) return null;
  const precio = nums.length > 1 && /[,.]\d{1,4}$/.test(t[fin + 1]) ? nums[1] : null;
  return { ref: t[iRef].toUpperCase(), descripcion: t.slice(iRef + 1, fin).join(' '), cantidad, precio };
}

export function lineasDe(texto) {
  const lineas = [];
  for (const fila of String(texto).split(/\r?\n/)) {
    const cols = limpiar(fila.replace(/€/g, ' ').split(/\t|;|\s{2,}|\s\|\s/).map((x) => x.trim()));
    const l = (cols.length >= 2 && deTrozos(cols)) || deTrozos(limpiar(fila.replace(/€/g, ' ').split(/[\s;|]+/)));
    if (l) lineas.push(l);
  }
  return lineas;
}

const RX_NUMERO = /(?:n[ºo°]\.?\s*(?:de\s*)?pedido|pedido\s*(?:n[ºo°.]*|number|#)?|order\s*(?:no\.?|number|#)?|orden de compra|\bpo\b)\s*[:#]?\s*([A-Z0-9][A-Z0-9/-]{2,})/gi;

export function extraer(e) {
  // Lo que llega ya ordenado (de otra oficina, p. ej. Comercial) no hace falta leerlo.
  if (e.estructurado) return { numero_pedido: null, fecha_entrega: null, direccion_entrega: null, lineas: [], ...e.estructurado };
  const todo = [e.asunto, e.texto, ...textos(e)].join('\n');
  let numero_pedido = null;
  for (const m of todo.matchAll(RX_NUMERO)) { if (/\d/.test(m[1])) { numero_pedido = m[1]; break; } }
  if (!numero_pedido) numero_pedido = ((/\b((?:PO|OC|PED)-\d[\w/-]*)/i.exec(todo)) || [])[1] || null;
  const f = /(?:entrega|entregar|delivery|servir)[^\n]{0,40}?(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|semana\s*\d{1,2})/i.exec(todo);
  const d = /(?:entregar en|direcci[oó]n de entrega|lugar de entrega|enviar a)\s*:?\s*([^\n.]{4,80})/i.exec(todo);
  let lineas = [];
  for (const t of textos(e)) lineas = lineas.concat(lineasDe(t));
  if (!lineas.length) lineas = lineasDe(e.texto || '');
  return { numero_pedido, fecha_entrega: f ? f[1] : null, direccion_entrega: d ? d[1].trim() : null, lineas };
}

export const flojo = (d) => !d.lineas.length || !d.numero_pedido;

// ---------- Gestión: IA (solo si las reglas no bastan) ----------
export const esquema = {
  type: 'object', additionalProperties: false,
  required: ['no_corresponde', 'numero_pedido', 'fecha_entrega', 'direccion_entrega', 'lineas'],
  properties: {
    no_corresponde: { type: 'boolean' },
    numero_pedido: { type: ['string', 'null'] },
    fecha_entrega: { type: ['string', 'null'] },
    direccion_entrega: { type: ['string', 'null'] },
    lineas: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['ref', 'descripcion', 'cantidad', 'precio'],
        properties: { ref: { type: 'string' }, descripcion: { type: 'string' }, cantidad: { type: 'number' }, precio: { type: ['number', 'null'] } },
      },
    },
  },
};
export const instrucciones = 'Trabajas en el puesto de Gestión de la oficina de Pedidos. Lee el correo y sus adjuntos y devuelve solo los datos del pedido. '
  + 'Copia las referencias tal cual aparecen (son las del cliente). No inventes nada: si un dato no está, pon null. '
  + 'Si no es un pedido de compra, no_corresponde = true y lineas vacías.';

export function unir(reglas, ia) {
  return {
    numero_pedido: reglas.numero_pedido || ia.numero_pedido,
    fecha_entrega: reglas.fecha_entrega || ia.fecha_entrega,
    direccion_entrega: reglas.direccion_entrega || ia.direccion_entrega,
    lineas: reglas.lineas.length ? reglas.lineas : (ia.lineas || []).map((l) => ({ ...l, ref: String(l.ref).toUpperCase() })),
  };
}

// ---------- Gestión: comprobar ----------
export async function validar(datos, c, { aceptados = [] } = {}) {
  const avisos = [];
  const cliente = c.exp.cliente;
  if (!cliente) avisos.push({ tipo: 'cliente', texto: `Remitente sin cliente asociado (${c.exp.entrada.de || '¿?'})` });
  if (!datos.numero_pedido) avisos.push({ tipo: 'numero', texto: 'Falta el número de pedido del cliente' });
  if (!datos.lineas.length) avisos.push({ tipo: 'lineas', texto: 'No hay líneas de pedido' });
  const catalogo = c.config.catalogo || [];
  const lineas = [];
  for (const l of datos.lineas) {
    let producto = l.producto && catalogo.some((p) => p.ref === l.producto) ? l.producto : null;
    if (!producto && cliente) producto = await c.equivalencia(cliente.id, l.ref);
    if (!producto) { const p = catalogo.find((x) => x.ref.toUpperCase() === l.ref); if (p) producto = p.ref; }
    if (!producto && !aceptados.includes(l.ref)) avisos.push({ tipo: 'referencia', ref: l.ref, texto: `¿Qué producto es ${l.ref}?` });
    lineas.push({ ...l, producto });
  }
  if (cliente && datos.numero_pedido) {
    const dup = await c.existe((e) => e.id !== c.exp.id && e.tipo === 'pedido' && e.estado === 'registrado' && e.cliente && e.cliente.id === cliente.id && e.datos && e.datos.numero_pedido === datos.numero_pedido);
    if (dup) avisos.push({ tipo: 'duplicado', texto: `El pedido ${datos.numero_pedido} de ${cliente.nombre} ya está registrado` });
  }
  return { datos: { ...datos, lineas }, avisos };
}

// ---------- Supervisión: corregir y aprender ----------
// cambios: { numero_pedido?, fecha_entrega?, direccion_entrega?, productos?: { [refCliente]: producto } }
export async function corregir(exp, cambios, c) {
  const productos = cambios.productos || {};
  const catalogo = c.config.catalogo || [];
  for (const [ref, prod] of Object.entries(productos)) {
    if (!catalogo.some((p) => p.ref === prod)) throw Object.assign(new Error(`El producto ${prod} no está en el catálogo`), { codigo: 400 });
    if (exp.cliente) await c.aprender(exp.cliente.id, ref, prod);
  }
  const datos = { ...exp.datos };
  for (const k of ['numero_pedido', 'fecha_entrega', 'direccion_entrega']) if (cambios[k] !== undefined) datos[k] = cambios[k];
  datos.lineas = exp.datos.lineas.map((l) => (productos[l.ref] ? { ...l, producto: productos[l.ref] } : l));
  return { datos };
}

export const resumir = (d) => `${d.lineas.length} líneas${d.numero_pedido ? ` · pedido ${d.numero_pedido}` : ''}`;
export const titulo = (exp) => (exp.datos && exp.datos.numero_pedido ? `Pedido ${exp.datos.numero_pedido}` : exp.entrada.asunto || 'Pedido');
