// Métricas de una oficina, sacadas del historial de cada expediente. Sirven para tres cosas:
// enseñar al cliente cuánto pasa solo, calibrar el modo simulación con tiempos reales
// y medir el «valor humano»: cuánto tarda y cuánto corrige la persona de Supervisión.

const ACCIONES_PERSONA = new Set(['aprobado', 'corregido', 'descartado', 'recuperado', 'reintento']);
const ms = (f) => Date.parse(f);

export function percentil(valores, q) {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * q, a = Math.floor(i), b = Math.ceil(i);
  return v[a] + (v[b] - v[a]) * (i - a);
}

/** Lo que se sabe de un expediente: tiempos por puesto, si lo tocó una persona y cuánto corrigió. */
export function metricasExpediente(exp) {
  const h = [...(exp.historial || [])].sort((a, b) => ms(a.fecha) - ms(b.fecha));
  const porPuesto = {};
  for (let i = 0; i < h.length - 1; i++) {
    const d = ms(h[i + 1].fecha) - ms(h[i].fecha);
    porPuesto[h[i].puesto] = (porPuesto[h[i].puesto] || 0) + d;
  }
  const espera = h.find((x) => x.puesto === 'supervision' && x.que === 'espera');
  const decision = espera && h.find((x) => x.puesto === 'supervision' && ['aprobado', 'descartado'].includes(x.que) && ms(x.fecha) >= ms(espera.fecha));
  const registro = h.find((x) => x.que === 'registrado');
  const persona = h.some((x) => ACCIONES_PERSONA.has(x.que));
  return {
    id: exp.id,
    estado: exp.estado,
    sin_tocar: exp.estado === 'registrado' && !persona,
    persona,
    correcciones: exp.correcciones || 0,
    espera_supervision_ms: espera && decision ? ms(decision.fecha) - ms(espera.fecha) : null,
    tiempo_total_ms: registro ? ms(registro.fecha) - ms(exp.recibido) : null,
    por_puesto_ms: porPuesto,
    lineas: (exp.datos && exp.datos.lineas) || [],
    ia_usd: (exp.ia && exp.ia.coste_usd) || 0,
  };
}

/** Resumen de la oficina. Los tiempos van en minutos. */
export function resumenMetricas(expedientes) {
  const m = expedientes.map(metricasExpediente);
  const reg = m.filter((x) => x.estado === 'registrado');
  const min = (x) => (x == null ? null : Math.round((x / 60000) * 10) / 10);
  const cruce = {};
  for (const x of m) for (const l of x.lineas) { const k = l.cruce || (l.producto ? 'dado' : 'sin_producto'); cruce[k] = (cruce[k] || 0) + 1; }
  const esperas = m.map((x) => x.espera_supervision_ms).filter((x) => x != null);
  const totales = reg.map((x) => x.tiempo_total_ms).filter((x) => x != null);
  const porEstado = {};
  for (const x of m) porEstado[x.estado] = (porEstado[x.estado] || 0) + 1;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  return {
    total: m.length,
    por_estado: porEstado,
    registrados: reg.length,
    sin_tocar_pct: pct(reg.filter((x) => x.sin_tocar).length, reg.length),
    aprobados_tal_cual_pct: pct(reg.filter((x) => x.persona && !x.correcciones).length, reg.length),
    con_correcciones_pct: pct(reg.filter((x) => x.correcciones > 0).length, reg.length),
    correcciones_total: m.reduce((s, x) => s + x.correcciones, 0),
    espera_supervision_min: { p50: min(percentil(esperas, 0.5)), p90: min(percentil(esperas, 0.9)), n: esperas.length },
    tiempo_hasta_registro_min: { p50: min(percentil(totales, 0.5)), p90: min(percentil(totales, 0.9)) },
    lineas_por_cruce: cruce,
    ia_usd: Math.round(m.reduce((s, x) => s + x.ia_usd, 0) * 1e6) / 1e6,
  };
}

/** Cuántos campos cambió la persona: cada campo de arriba y cada línea cuenta uno. */
export function contarCambios(antes, despues) {
  if (!antes || !despues) return 0;
  let n = 0;
  for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    if (k === 'lineas' && Array.isArray(antes.lineas) && Array.isArray(despues.lineas)) {
      const L = Math.max(antes.lineas.length, despues.lineas.length);
      for (let i = 0; i < L; i++) {
        const a = antes.lineas[i], b = despues.lineas[i];
        if (!a || !b || a.producto !== b.producto || a.cantidad !== b.cantidad || a.precio !== b.precio) n += 1;
      }
    } else if (JSON.stringify(antes[k]) !== JSON.stringify(despues[k])) n += 1;
  }
  return n;
}
