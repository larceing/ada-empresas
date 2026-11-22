// Modo simulación: las MISMAS oficinas de Ada base, con un reloj que se adelanta, pedidos falsos y personas simuladas.
// Simulación de eventos discretos: llegan pedidos a su hora, Recepción y Gestión trabajan al instante (son reglas),
// lo dudoso hace cola en Supervisión y lo atiende una persona en su horario, con tiempos variables,
// interrupciones, ausencias y algún error. Al final: métricas de la oficina, tablero de proceso y horas de persona.
import { crearOficina } from '../nucleo/oficina.js';
import { crearMemoria } from '../nucleo/memoria.js';
import { crearBus } from '../nucleo/bus.js';
import * as pedido from '../nucleo/plantillas/pedido.js';
import { percentil } from '../nucleo/metricas.js';
import { crearAzar } from './azar.js';
import { generarPedidos } from './generador.js';

const H = 3600e3, MIN = 60e3, DIA = 24 * H;

/** Cola de eventos ordenada por tiempo (montículo binario). */
function crearAgenda() {
  const a = [];
  let seq = 0;
  const menor = (i, j) => a[i].t < a[j].t || (a[i].t === a[j].t && a[i].n < a[j].n);
  return {
    poner(t, tipo, datos) {
      a.push({ t, tipo, datos, n: seq++ });
      let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (!menor(i, p)) break; [a[i], a[p]] = [a[p], a[i]]; i = p; }
    },
    sacar() {
      const top = a[0], fin = a.pop();
      if (a.length) {
        a[0] = fin; let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && menor(l, m)) m = l; if (r < a.length && menor(r, m)) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; }
      }
      return top;
    },
    get vacia() { return a.length === 0; },
  };
}

/** Siguiente momento en que la persona trabaja (jornada en horas UTC del día, días laborables 1..5). */
function siguienteHueco(t, jornada, ausente) {
  for (let k = 0; k < 400; k++) {
    const d = new Date(t);
    const dia0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const ini = dia0 + jornada.inicio * H, fin = dia0 + jornada.fin * H;
    const laborable = (jornada.dias || [1, 2, 3, 4, 5]).includes(d.getUTCDay()) && !ausente(dia0);
    if (laborable && t < fin) return Math.max(t, ini);
    t = dia0 + DIA;
  }
  return t;
}

/**
 * @param {object} o
 * @param {object} o.espacio     clientes y catálogo
 * @param {object} o.modelo      { oficina: parámetros del generador, personas: {...}, ada: { piloto_tras, cruce_auto } }
 * @param {'manual'|'ada'} o.escenario  manual: una persona teclea cada pedido; ada: la oficina y la persona solo supervisa
 * @param {number} o.semilla
 * @param {number} [o.dias=365]
 */
export async function simular({ espacio, modelo = {}, escenario = 'ada', semilla = 1, dias = 365, inicio = Date.UTC(2027, 0, 4) }) {
  const az = crearAzar(semilla);
  const P = {
    personas: 1, jornada: { inicio: 8, fin: 15, dias: [1, 2, 3, 4, 5] }, ausencia_dia: 0.04,
    teclear_min: { mediana: 3, sigma: 0.4 }, teclear_linea_min: { mediana: 0.7, sigma: 0.4 },
    revisar_min: { mediana: 0.8, sigma: 0.4 }, aviso_min: { mediana: 1.2, sigma: 0.5 }, propuesta_min: { mediana: 0.2, sigma: 0.4 },
    alta_cliente_min: { mediana: 6, sigma: 0.4 }, interrupcion: 0.2, error_linea_manual: { min: 0.01, probable: 0.02, max: 0.03 }, error_supervision: 0.003,
    ...(modelo.personas || {}),
  };
  const ADA = { piloto_tras: 8, cruce_auto: null, ...(modelo.ada || {}) };
  const errorManual = az.valor(P.error_linea_manual);
  const pedidos = generarPedidos({ azar: az, espacio, inicio, dias, modelo: modelo.oficina });

  let ahora = inicio;
  const reloj = () => ahora;
  const bus = crearBus({ reloj, maximo: 10 });
  const mem = crearMemoria({ ...JSON.parse(JSON.stringify(espacio)), automatico: [], ...(ADA.cruce_auto ? { cruce: { auto: ADA.cruce_auto } } : {}) });
  const of = escenario === 'ada' ? crearOficina({ id: 'pedidos', nombre: 'Pedidos', plantilla: pedido, almacen: mem, bus, reloj }) : null;

  const ausencias = new Set();
  const ausente = (dia0) => { if (!ausencias.has(`?${dia0}`)) { ausencias.add(`?${dia0}`); if (az.si(P.ausencia_dia)) ausencias.add(dia0); } return ausencias.has(dia0); };
  const agenda = crearAgenda();
  for (const p of pedidos) agenda.poner(p.t, 'llega', p);
  const cola = [];
  const libres = Array.from({ length: P.personas }, (_, i) => ({ id: i + 1, libre: true }));
  const verdades = new Map();
  const limpios = {}; // cliente → aprobados seguidos sin correcciones (para el piloto automático)
  const st = { minutos_persona: 0, por_mes: Array(12).fill(0), esperas: [], cola_max: 0, errores_lineas: 0, lineas: 0, registrados: 0, descartados: 0, duplicados_colados: 0, pedidos: pedidos.length };

  const duracion = (trabajo) => {
    let m = trabajo;
    if (az.si(P.interrupcion)) m *= az.entre(1.2, 1.8);
    return m * MIN;
  };
  function tiempoSupervision(exp) {
    let m = az.valor(P.revisar_min);
    for (const a of exp.avisos) m += a.propuesta ? az.valor(P.propuesta_min) : a.tipo === 'cliente' ? az.valor(P.alta_cliente_min) : az.valor(P.aviso_min);
    return m;
  }
  function tiempoManual(p) { return az.valor(P.teclear_min) + p.verdad.lineas.length * az.valor(P.teclear_linea_min); }

  function asignar() {
    for (const per of libres) {
      if (!per.libre || !cola.length) continue;
      const t = siguienteHueco(ahora, P.jornada, ausente);
      if (t > ahora) { if (!per.despertar) { per.despertar = true; agenda.poner(t, 'despierta', per); } continue; }
      const item = cola.shift();
      per.libre = false;
      const min = item.minutos;
      agenda.poner(ahora + duracion(min), 'termina', { per, item, min });
    }
  }

  async function terminaAda({ item }) {
    const exp = await of.obtener(item.id);
    const v = item.verdad;
    if (exp.estado !== 'por_revisar') return;
    if (v.duplicado) { await of.descartar(exp.id, 'Duplicado', 'Persona'); st.descartados += 1; return; }
    const cambios = { productos: {} };
    for (const a of exp.avisos) {
      if (a.tipo === 'cliente' && !v.cliente) {
        const id = `nuevo-${exp.id.slice(0, 6)}`;
        const c = await mem.config(); c.clientes.push({ id, nombre: `Cliente nuevo ${id}`, dominios: [String(exp.entrada.de).split('@')[1]] }); await mem.guardarConfig(c);
        cambios.cliente_id = id;
      } else if (a.tipo === 'numero') cambios.numero_pedido = `SIN-${exp.id.slice(0, 6)}`;
      else if (a.tipo === 'referencia') {
        const real = (v.lineas.find((l) => l.ref === a.ref) || {}).producto;
        let elegido = real;
        if (az.si(P.error_supervision)) elegido = az.elegir(espacio.catalogo).ref;
        if (elegido) cambios.productos[a.ref] = elegido;
      }
    }
    if (!Object.keys(cambios.productos).length) delete cambios.productos;
    let r = await of.aprobar(exp.id, cambios, 'Persona');
    if (r.estado === 'por_revisar') { r = await of.descartar(exp.id, 'No se pudo resolver', 'Persona'); st.descartados += 1; return; }
    cuentaRegistro(r, v);
  }
  function cuentaRegistro(exp, v) {
    st.registrados += 1;
    if (v.duplicado) st.duplicados_colados += 1;
    for (const l of exp.datos.lineas) {
      st.lineas += 1;
      const real = v.lineas.find((x) => x.ref === l.ref);
      if (!real || real.producto !== l.producto || real.cantidad !== l.cantidad) st.errores_lineas += 1;
    }
    const cl = exp.cliente && exp.cliente.id;
    if (cl) limpios[cl] = exp.correcciones ? 0 : (limpios[cl] || 0) + 1;
  }
  const enPiloto = new Set();
  async function revisarPiloto() {
    if (!ADA.piloto_tras) return;
    const nuevos = Object.entries(limpios).filter(([k, n]) => n >= ADA.piloto_tras && !enPiloto.has(k)).map(([k]) => k);
    if (!nuevos.length) return;
    for (const k of nuevos) enPiloto.add(k);
    const c = await mem.config(); c.automatico = [...enPiloto]; await mem.guardarConfig(c);
  }

  while (!agenda.vacia) {
    const ev = agenda.sacar();
    ahora = ev.t;
    if (ev.tipo === 'llega') {
      const p = ev.datos;
      if (escenario === 'ada') {
        const exp = await of.entrar(p.entrada);
        await bus.calma();
        if (exp.estado === 'por_revisar') { cola.push({ id: exp.id, llegada: ahora, verdad: p.verdad, minutos: tiempoSupervision(exp) }); }
        else if (exp.estado === 'registrado') { cuentaRegistro(exp, p.verdad); st.esperas.push(0); }
      } else {
        cola.push({ llegada: ahora, verdad: p.verdad, minutos: tiempoManual(p) });
      }
      st.cola_max = Math.max(st.cola_max, cola.length);
    } else if (ev.tipo === 'despierta') {
      ev.datos.despertar = false;
    } else if (ev.tipo === 'termina') {
      const { per, item, min } = ev.datos;
      per.libre = true;
      st.minutos_persona += min;
      st.por_mes[new Date(ahora).getUTCMonth()] += min;
      st.esperas.push(ahora - item.llegada);
      if (escenario === 'ada') { await terminaAda({ item }); await revisarPiloto(); }
      else {
        if (item.verdad.duplicado && az.si(0.7)) { st.descartados += 1; } // la persona se da cuenta casi siempre
        else {
          st.registrados += 1;
          if (item.verdad.duplicado) st.duplicados_colados += 1;
          for (const _l of item.verdad.lineas) { st.lineas += 1; if (az.si(errorManual)) st.errores_lineas += 1; }
        }
      }
    }
    asignar();
  }

  const horas = (m) => Math.round((m / 60) * 10) / 10;
  const esperasH = st.esperas.map((x) => x / H);
  const resultado = {
    escenario, semilla, dias, pedidos: st.pedidos,
    registrados: st.registrados, descartados: st.descartados,
    horas_persona_ano: horas(st.minutos_persona),
    horas_persona_mes: horas(st.minutos_persona / 12),
    horas_mes_pico: horas(Math.max(...st.por_mes)),
    espera_horas: { p50: Math.round(percentil(esperasH, 0.5) * 10) / 10, p90: Math.round(percentil(esperasH, 0.9) * 10) / 10 },
    cola_max: st.cola_max,
    lineas: st.lineas,
    errores_lineas: st.errores_lineas,
    error_lineas_pct: st.lineas ? Math.round((st.errores_lineas / st.lineas) * 10000) / 100 : 0,
    duplicados_colados: st.duplicados_colados,
  };
  if (of) {
    resultado.metricas = await of.metricas();
    resultado.proceso = await of.proceso();
    resultado.clientes_en_piloto = (await mem.config()).automatico.length;
    resultado.expedientes = () => of.listar();
  }
  return resultado;
}
