// Plantilla «fabricacion» (Ada Planta, de ada-fábrica): cada orden lanzada por Producción pasa por las fases
// de la línea. La lectura de máquinas (Efesto) solo lee: nunca manda órdenes a las máquinas.

export const nombre = 'fabricacion';
export const escucha = 'produccion.registrado';
export const estadosSeguimiento = ['en_linea', 'terminada', 'albaran'];
export const FASES = ['Corte láser', 'Plegado', 'Pintura', 'Embalaje'];
export const puestos = {
  recepcion: { nombre: 'Recepción de órdenes', tarea: 'Recoge las órdenes lanzadas por Producción' },
  gestion: { nombre: 'Planificación', tarea: 'Ordena las fases y calcula el material' },
  supervision: { nombre: 'Jefe de planta', tarea: 'Da el visto bueno a lo que no cuadra' },
  registro: { nombre: 'Línea (Efesto)', tarea: 'Pone la orden en la línea y lee piezas buenas y malas' },
  seguimiento: { nombre: 'Almacén', tarea: 'Recibe lo terminado y hace el albarán con la PDA' },
};

export function desdeEvento(_evento, d) {
  if (!d.datos.fabricar.length && !d.datos.servir.length) return null;
  return { canal: 'produccion', de: 'Oficina de Producción', asunto: d.titulo, origen: { oficina: d.oficina, id: d.id }, pedido: d.datos.pedido, cliente: d.cliente, fabricar: d.datos.fabricar, servir: d.datos.servir };
}
export const identificar = (e) => e.cliente || null;
export const clasificar = () => ({ es: true, motivo: 'Orden de Producción' });

export function extraer(e, c) {
  const materiales = (c.config.planta || {}).materiales || {};
  const necesita = {};
  for (const f of e.fabricar) {
    const m = materiales[f.producto];
    if (m) necesita[m.material] = (necesita[m.material] || 0) + Math.ceil(f.cantidad * m.por_ud);
  }
  return { orden: e.origen, pedido: e.pedido, fases: FASES, fabricar: e.fabricar, servir: e.servir, material: necesita };
}

export async function validar(datos, c, { aceptados = [] } = {}) {
  const avisos = [];
  const stock = (c.config.planta || {}).stock || {};
  for (const [m, n] of Object.entries(datos.material)) {
    if ((stock[m] || 0) < n && !aceptados.includes(m)) avisos.push({ tipo: 'material', ref: m, texto: `Falta material: ${m} (hacen ${n}, hay ${stock[m] || 0})` });
  }
  return { datos, avisos };
}

export async function corregir(exp, cambios) {
  return { datos: exp.datos, aceptados: cambios.material_pedido ? Object.keys(exp.datos.material) : [] };
}

export const resumir = (d) => `${d.fabricar.reduce((n, f) => n + f.cantidad, 0)} piezas · ${d.fases.length} fases`;
export const titulo = (exp) => `Fabricar ${String(exp.entrada.asunto).replace(/^Orden del /, '')}`;
