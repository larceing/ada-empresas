// Plantilla «orden» (Ada Producción, de ada-fábrica): cada pedido registrado se convierte en lo que hay que
// servir del almacén y lo que hay que fabricar. Escucha a la oficina de Pedidos.

export const nombre = 'orden';
export const escucha = 'pedidos.registrado';
export const estadosSeguimiento = ['lanzada', 'en_planta', 'terminada'];
export const puestos = {
  recepcion: { tarea: 'Recoge los pedidos registrados' },
  gestion: { tarea: 'Mira el stock y separa lo que se sirve de lo que se fabrica' },
  supervision: { tarea: 'El jefe de producción aprueba las órdenes' },
  registro: { tarea: 'Lanza las órdenes de fabricación' },
  seguimiento: { tarea: 'Sigue las órdenes en planta' },
};

export function desdeEvento(_evento, d) {
  return {
    canal: 'pedidos', de: 'Oficina de Pedidos', asunto: `Pedido ${d.datos.numero_pedido || d.id}`,
    origen: { oficina: d.oficina, id: d.id }, cliente: d.cliente, lineas: d.datos.lineas, entrega: d.datos.fecha_entrega,
  };
}

export const identificar = (e) => e.cliente || null;
export const clasificar = (e) => (e.lineas && e.lineas.length ? { es: true, motivo: 'Pedido registrado' } : { es: false, motivo: 'Sin líneas' });

export function extraer(e, c) {
  const stock = { ...((c.config.produccion || {}).stock || {}) };
  const servir = [], fabricar = [];
  for (const l of e.lineas) {
    const hay = Math.max(0, stock[l.producto] || 0);
    const deAlmacen = Math.min(hay, l.cantidad);
    stock[l.producto] = hay - deAlmacen;
    if (deAlmacen) servir.push({ producto: l.producto, cantidad: deAlmacen });
    if (l.cantidad - deAlmacen > 0) fabricar.push({ producto: l.producto, cantidad: l.cantidad - deAlmacen });
  }
  return { pedido: e.origen, entrega: e.entrega || null, servir, fabricar };
}

export async function validar(datos, c) {
  const avisos = [];
  const capacidad = (c.config.produccion || {}).capacidad_dia || {};
  for (const f of datos.fabricar) {
    if (!f.producto) avisos.push({ tipo: 'producto', texto: 'Línea sin producto' });
    else if (capacidad[f.producto] && f.cantidad > capacidad[f.producto] * 5) avisos.push({ tipo: 'capacidad', texto: `${f.cantidad} de ${f.producto} es más de una semana de máquina` });
  }
  return { datos, avisos };
}

export const resumir = (d) => `${d.fabricar.length} a fabricar · ${d.servir.length} del almacén`;
export const titulo = (exp) => `Orden · ${exp.entrada.asunto}`;
