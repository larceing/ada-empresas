// Plantilla «oportunidad» (Ada Comercial, de ada-commercial): lo que el comercial cierra en la tablet (Brokkr).
// Un cliente nuevo necesita el OK de la jefa comercial para darse de alta; al registrar, Pedidos recibe el pedido.

export const nombre = 'oportunidad';
export const estadosSeguimiento = ['pedido_creado'];
export const puestos = {
  recepcion: { nombre: 'Recepción de contactos', tarea: 'Recoge lo que llega de la web, ferias y la tablet' },
  gestion: { nombre: 'Comercial', tarea: 'Prepara la oportunidad: cliente, producto y unidades' },
  supervision: { nombre: 'Jefa comercial', tarea: 'Aprueba clientes nuevos y descuentos' },
  registro: { nombre: 'Alta en el ERP', tarea: 'Da de alta el cliente y la oportunidad ganada' },
  seguimiento: { nombre: 'Posventa', tarea: 'Comprueba que el pedido llega a Pedidos' },
};

export function identificar(e, c) {
  if (!e.cliente_id) return null;
  const x = (c.config.clientes || []).find((y) => y.id === e.cliente_id);
  return x ? { id: x.id, nombre: x.nombre } : null;
}
export const clasificar = (e) => (e.ganada ? { es: true, motivo: 'Oportunidad ganada' } : { es: false, motivo: 'Aún no está ganada' });

export function extraer(e) {
  return {
    titulo: e.titulo || 'Oportunidad',
    cliente_nuevo: e.cliente_nuevo || null,
    lineas: (e.lineas || []).map((l) => ({ ref: l.producto, producto: l.producto, cantidad: Number(l.cantidad) || 0, precio: l.precio ?? null })),
  };
}

export async function validar(datos, c) {
  const avisos = [];
  if (!c.exp.cliente && !datos.cliente_nuevo) avisos.push({ tipo: 'cliente', texto: 'Falta el cliente' });
  if (!c.exp.cliente && datos.cliente_nuevo && !datos.alta_aprobada) avisos.push({ tipo: 'cliente_nuevo', texto: `Cliente nuevo: ${datos.cliente_nuevo.nombre}. ¿Se da de alta?` });
  const cat = c.config.catalogo || [];
  for (const l of datos.lineas) {
    if (!cat.some((p) => p.ref === l.producto)) avisos.push({ tipo: 'producto', texto: `Producto desconocido: ${l.producto}` });
    if (!(l.cantidad > 0)) avisos.push({ tipo: 'cantidad', texto: `Cantidad no válida en ${l.producto}` });
  }
  return { datos, avisos };
}

export async function corregir(exp, cambios) {
  return { datos: { ...exp.datos, ...(cambios.alta ? { alta_aprobada: true } : {}) } };
}

export const resumir = (d) => `${d.lineas.length} líneas${d.cliente_nuevo ? ' · cliente nuevo' : ''}`;
export const titulo = (exp) => exp.datos ? exp.datos.titulo : exp.entrada.titulo || 'Oportunidad';
