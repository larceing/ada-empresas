// Simular una empresa desde cero: un modelo en JSON (variables con rango y fuente) y Montecarlo sobre su primer año.
// La IA, cuando llegue, solo RELLENA el JSON (con fuente para cada número); las cuentas las hace este motor.
// Primer tipo: «importacion-distribucion» (comprar por contenedores fuera de la UE y vender a una red de tiendas).
import { crearAzar, probable } from './azar.js';
import { percentil } from '../nucleo/metricas.js';
import { rango } from './montecarlo.js';

/** Lee las variables del modelo con azar y apunta qué salió (para la sensibilidad). */
function muestreador(az, variables) {
  const salio = {};
  const v = (k) => {
    if (k in salio) return salio[k];
    const d = variables[k];
    if (d === undefined) throw new Error(`Falta la variable «${k}» en el modelo`);
    let x = Array.isArray(d) ? d : az.valor(d);
    if (d && d.entero) x = Math.round(x);
    salio[k] = x;
    return x;
  };
  return { v, salio };
}

const TIPOS = {
  /** Port del motor del caso motos (docs/procesos/familia-ada/simulador-motos/motos_mc.py). */
  'importacion-distribucion'(az, V) {
    const { v } = V;
    const fx = v('usd_por_eur'), fob = v('fob_usd'), upc = v('unidades_contenedor'), flete = v('flete_usd');
    const destino = v('destino_eur_contenedor'), prep = v('preparacion_eur'), margenRed = v('margen_red_pct');
    const garantia = v('garantia_tasa') * v('garantia_coste_eur');
    const lam = v('ventas_por_tienda_mes'), tiendasFin = v('tiendas_finales'), tiendasIni = v('tiendas_iniciales'), rampa = v('meses_rampa');
    const guerra = az.si(v('p_guerra_precios'));
    const fijoMes = Object.keys(V.fijos).reduce((s, k) => s + v(k), 0);
    const arancel = v('arancel_pct'), iva = v('iva_pct'), seguro = v('seguro_pct');
    const neto = (v('pvp_iva_eur') / (1 + iva)) * (guerra ? 1 - v('bajada_guerra_pct') : 1);
    const mayorista = neto * (1 - margenRed);
    const fobEur = fob / fx, fleteUd = flete / fx / upc;
    const cif = (fobEur + fleteUd) * (1 + seguro);
    const puesta = cif * (1 + arancel) + destino / upc + prep;
    const estac = v('estacionalidad');
    const meses = v('meses');
    let stock = 0, caja = -v('arranque_eur'), resultado = caja, cajaMin = caja, vendidas = 0, rotura = 0;
    const camino = [], ivaPend = [];
    const pedir = (mes) => {
      let lead = az.valor(V.vars.plazo_dias) / 30;
      if (az.si(v('p_retraso'))) lead += az.valor(V.vars.retraso_dias) / 30;
      if (az.si(v('p_retencion_aduana'))) lead += az.valor(V.vars.retencion_dias) / 30;
      const coste = upc * cif;
      caja -= v('anticipo_pct') * coste;
      camino.push({ llega: mes + lead, uds: upc, coste });
    };
    for (let i = 0; i < (V.vars.contenedores_iniciales ?? 2); i++) pedir(0);
    for (let mes = 0; mes < meses; mes++) {
      for (const x of camino.filter((y) => y.llega <= mes + 1)) {
        camino.splice(camino.indexOf(x), 1);
        caja -= (1 - v('anticipo_pct')) * x.coste + x.coste * arancel + destino;
        const ivaImp = x.coste * (1 + arancel) * iva; caja -= ivaImp; ivaPend.push({ mes: mes + v('iva_recupera_meses'), imp: ivaImp });
        stock += x.uds;
      }
      const tiendas = tiendasIni + (tiendasFin - tiendasIni) * Math.min(1, mes / rampa);
      const demanda = az.poisson(lam * tiendas * (estac[mes % 12] ?? 1) * Math.min(1, 0.4 + mes / 6));
      const vend = Math.min(stock, demanda); rotura += demanda - vend; stock -= vend; vendidas += vend;
      caja += vend * mayorista - vend * prep - fijoMes - vend * garantia * 0.3;
      resultado += vend * (mayorista - puesta) - fijoMes - vend * garantia;
      for (const p of ivaPend.filter((x) => x.mes <= mes)) { caja += p.imp; ivaPend.splice(ivaPend.indexOf(p), 1); }
      cajaMin = Math.min(cajaMin, caja);
      const enCamino = camino.reduce((s, x) => s + x.uds, 0);
      if (stock + enCamino < v('stock_meses_objetivo') * lam * tiendas * 1.1 && mes < meses - 2) pedir(mes);
    }
    return { coste_puesta_ud: puesta, precio_red_ud: mayorista, margen_ud: mayorista - puesta - garantia, margen_pct: (mayorista - puesta - garantia) / mayorista, vendidas, rotura, resultado_ano1: resultado, caja_minima: cajaMin, fijo_mes: fijoMes, guerra: guerra ? 1 : 0 };
  },
};

const rk = (x) => { const o = x.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = Array(x.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
function spearman(a, b) {
  const x = rk(a), y = rk(b), n = x.length, mx = (n - 1) / 2;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - mx); sxx += (x[i] - mx) ** 2; syy += (y[i] - mx) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/**
 * @param {object} modelo  { nombre, tipo, variables: { k: { min, probable, max, fuente, fecha } }, costes_fijos_mes: { k: {...} } }
 * @returns resumen con P10/P50/P90, probabilidad de pérdidas, punto de equilibrio, sensibilidad y la lista de supuestos con su fuente
 */
export function simularEmpresa(modelo, { iteraciones = 10000, semilla = 2026 } = {}) {
  const motor = TIPOS[modelo.tipo];
  if (!motor) throw new Error(`Tipo de empresa sin motor: ${modelo.tipo}. Hay: ${Object.keys(TIPOS).join(', ')}`);
  const az = crearAzar(semilla);
  const vars = { ...modelo.variables, ...(modelo.costes_fijos_mes || {}) };
  const corridas = [];
  for (let i = 0; i < iteraciones; i++) {
    const m = muestreador(az, vars);
    const r = motor(az, { v: m.v, vars, fijos: modelo.costes_fijos_mes || {} });
    corridas.push({ r, s: { ...m.salio, guerra_precios: r.guerra } });
  }
  const col = (k) => corridas.map((c) => c.r[k]);
  const salidas = ['coste_puesta_ud', 'precio_red_ud', 'margen_ud', 'margen_pct', 'vendidas', 'rotura', 'resultado_ano1', 'caja_minima'];
  const resumen = Object.fromEntries(salidas.map((k) => [k, k === 'margen_pct' ? Object.fromEntries(Object.entries(rango(col(k).map((x) => x * 100)))) : rango(col(k))]));
  const res = col('resultado_ano1');
  const sens = {};
  for (const k of Object.keys(corridas[0].s)) {
    const xs = corridas.map((c) => c.s[k]);
    if (typeof xs[0] !== 'number' || new Set(xs.slice(0, 50)).size < 2) continue;
    sens[k] = Math.round(spearman(xs, res) * 100) / 100;
  }
  const fijo50 = percentil(col('fijo_mes'), 0.5), margen50 = percentil(col('margen_ud'), 0.5);
  const supuestos = Object.entries(vars).map(([k, d]) => ({
    variable: k, probable: Array.isArray(d) ? d : probable(d),
    ...(d && d.min !== undefined ? { min: d.min, max: d.max } : {}),
    fuente: (d && d.fuente) || 'supuesto', ...(d && d.fecha ? { fecha: d.fecha } : {}),
  }));
  return {
    nombre: modelo.nombre, tipo: modelo.tipo, iteraciones, semilla,
    resultados: resumen,
    probabilidad_perdidas_ano1_pct: Math.round((res.filter((x) => x < 0).length / res.length) * 1000) / 10,
    punto_equilibrio_ud_mes: Math.round((fijo50 / margen50) * 10) / 10,
    sensibilidad: Object.fromEntries(Object.entries(sens).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))),
    supuestos,
    sin_fuente: supuestos.filter((s) => s.fuente === 'supuesto').map((s) => s.variable),
  };
}
