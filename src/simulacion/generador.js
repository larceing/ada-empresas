// Pedidos falsos para el modo simulación: un periodo entero de correos de pedido con lo que pasa de verdad
// (estacionalidad, días de la semana, formatos, clientes que usan su propia referencia, erratas, duplicados…).
// Cada pedido lleva su «verdad» (qué pidió de verdad el cliente) para medir cuántos errores se cuelan.
// Las entradas tienen ya el texto de los adjuntos (como si Recepción los hubiera leído), para no depender de pdftotext.

const DIA = 86400e3;

function variarNombre(az, nombre) {
  const p = String(nombre).split(/\s+/);
  const r = az.u();
  if (r < 0.3) return p.slice().reverse().join(' ');
  if (r < 0.5) return p.map((x) => (x.length > 6 ? x.slice(0, 5) + '.' : x)).join(' ');
  if (r < 0.6) return nombre.toUpperCase();
  return nombre;
}
function errata(az, ref) {
  const i = az.entero(0, ref.length - 1);
  const c = ref[i];
  const cambio = /\d/.test(c) ? String((Number(c) + az.entero(1, 8)) % 10) : c === '-' ? '' : c === 'O' ? '0' : 'X';
  return ref.slice(0, i) + cambio + ref.slice(i + 1);
}

/**
 * @param {object} o
 * @param {object} o.azar            crearAzar(semilla)
 * @param {object} o.espacio         { clientes: [{ id, nombre, dominios }], catalogo: [{ ref, nombre }] }
 * @param {number} o.inicio          ms del primer día
 * @param {number} o.dias            cuántos días
 * @param {object} o.modelo          parámetros (ver plantillas-empresa/*.json → oficina)
 */
export function generarPedidos({ azar: az, espacio, inicio, dias, modelo }) {
  const m = {
    pedidos_dia_laborable: { min: 15, probable: 25, max: 40 },
    estacionalidad: [0.8, 0.9, 1, 1.05, 1.1, 1.1, 1, 0.6, 1.05, 1.1, 1.05, 0.9],
    fin_de_semana: 0.05,
    horas: [7, 20],
    formatos: { texto: 0.35, pdf: 0.4, excel: 0.15, escaneado: 0.1 },
    lineas_por_pedido: { min: 1, probable: 3, max: 12 },
    cantidad: { mediana: 60, sigma: 1 },
    p_ref_propia: 0.3, p_errata: 0.04, p_ref_desconocida: 0.01, p_sin_numero: 0.05, p_duplicado: 0.02, p_remitente_nuevo: 0.02,
    ...(modelo || {}),
  };
  const { clientes, catalogo } = espacio;
  // Algunos clientes piden con su propia referencia, siempre la misma para cada producto
  const propias = {};
  for (const c of clientes) {
    propias[c.id] = {};
    const pref = c.id.slice(0, 2).toUpperCase();
    for (const p of catalogo) propias[c.id][p.ref] = `${pref}-${az.entero(1000, 9999)}`;
  }
  const usaPropia = Object.fromEntries(clientes.map((c) => [c.id, az.si(m.p_ref_propia * 2)]));
  const pesoCliente = Object.fromEntries(clientes.map((c) => [c.id, az.lognormal(1, 0.8)])); // pocos clientes hacen muchos pedidos
  const pesoProducto = Object.fromEntries(catalogo.map((p) => [p.ref, az.lognormal(1, 0.9)]));
  const diaPedido = az.valor(m.pedidos_dia_laborable);
  const salida = [];
  let n = 0;
  const enviados = [];
  for (let d = 0; d < dias; d++) {
    const t0 = inicio + d * DIA;
    const f = new Date(t0);
    const finde = [0, 6].includes(f.getUTCDay());
    const lam = diaPedido * (m.estacionalidad[f.getUTCMonth()] ?? 1) * (finde ? m.fin_de_semana : 1);
    const k = az.poisson(lam);
    for (let i = 0; i < k; i++) {
      // Duplicado: el cliente reenvía un pedido anterior
      if (enviados.length && az.si(m.p_duplicado)) {
        const o = az.elegir(enviados.slice(-40));
        const t = t0 + az.entre(m.horas[0], m.horas[1]) * 3600e3;
        salida.push({ t, entrada: { ...o.entrada, asunto: `RV: ${o.entrada.asunto}` }, verdad: { ...o.verdad, duplicado: true } });
        continue;
      }
      n += 1;
      const nuevo = az.si(m.p_remitente_nuevo);
      const idCl = nuevo ? null : az.segun(pesoCliente);
      const cl = idCl ? clientes.find((c) => c.id === idCl) : null;
      const nl = Math.max(1, Math.round(az.valor(m.lineas_por_pedido)));
      const elegidos = new Set();
      for (let k = 0; elegidos.size < Math.min(nl, catalogo.length) && k < 200; k++) elegidos.add(az.segun(pesoProducto));
      const lineas = [...elegidos].map((ref) => {
        const p = catalogo.find((x) => x.ref === ref);
        const cantidad = Math.max(1, Math.round(az.valor(m.cantidad)));
        let refTxt = ref, desc = p.nombre || '', tipo = 'exacta';
        if (cl && usaPropia[cl.id]) { refTxt = propias[cl.id][ref]; desc = variarNombre(az, desc); tipo = 'propia'; }
        if (az.si(m.p_errata)) { refTxt = errata(az, refTxt); tipo = 'errata'; }
        if (az.si(m.p_ref_desconocida)) { refTxt = `ZZ-${az.entero(100, 999)}`; desc = 'Artículo especial'; tipo = 'desconocida'; }
        return { producto: ref, cantidad, refTxt, desc, tipo };
      });
      const numero = az.si(m.p_sin_numero) ? null : `PO-${new Date(t0).getUTCFullYear()}-${String(n).padStart(5, '0')}`;
      const formato = az.segun(m.formatos);
      const tabla = lineas.map((l) => (formato === 'excel' ? [l.refTxt, l.desc, l.cantidad].join('\t') : `${l.refTxt}    ${l.desc}    ${l.cantidad}`)).join('\n');
      const cab = `${numero ? `Pedido nº ${numero}\n` : ''}Referencia    Descripción    Cantidad\n`;
      const de = cl ? `compras@${(cl.dominios || [`${cl.id}.test`])[0]}` : `info@cliente-nuevo-${n}.test`;
      const asunto = numero ? `Pedido ${numero}` : 'Pedido';
      let entrada;
      if (formato === 'texto') entrada = { canal: 'correo', de, asunto, texto: `Buenos días,\n\n${cab}${tabla}\n\nGracias.` };
      else {
        const ruido = formato === 'escaneado' ? (t) => t.replace(/0/g, () => (az.si(0.03) ? 'O' : '0')) : (t) => t;
        entrada = { canal: 'correo', de, asunto, texto: 'Adjunto pedido.', adjuntos: [{ nombre: `${numero || 'pedido'}.${formato === 'excel' ? 'xlsx' : 'pdf'}`, texto: ruido(cab + tabla), metodo: formato === 'excel' ? 'excel' : formato === 'escaneado' ? 'ocr' : 'pdf-texto' }] };
      }
      const t = t0 + az.entre(m.horas[0], m.horas[1]) * 3600e3;
      const ped = { t, entrada, verdad: { cliente: cl ? cl.id : null, numero, lineas: lineas.map((l) => ({ ref: l.refTxt.toUpperCase(), producto: l.producto, cantidad: l.cantidad, tipo: l.tipo })), formato, duplicado: false } };
      salida.push(ped);
      enviados.push(ped);
    }
  }
  return salida.sort((a, b) => a.t - b.t);
}
