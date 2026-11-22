import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { crearOficina } from '../src/nucleo/oficina.js';
import { crearMemoria } from '../src/nucleo/memoria.js';
import { crearBus } from '../src/nucleo/bus.js';
import * as pedido from '../src/nucleo/plantillas/pedido.js';
import * as produccion from '../src/nucleo/plantillas/produccion.js';
import { parecidoEdicion, parecidoTrigramas, buscarParecido } from '../src/nucleo/similitud.js';
import { aOcel } from '../src/nucleo/ocel.js';
import { simular } from '../src/simulacion/motor.js';
import { montecarlo } from '../src/simulacion/montecarlo.js';
import { simularEmpresa } from '../src/simulacion/empresa.js';
import { crearAzar } from '../src/simulacion/azar.js';
import { ESPACIO } from '../banco/generar.js';

const MODELO_OFICINA = JSON.parse(fs.readFileSync(new URL('../plantillas-empresa/distribuidor-tornilleria.json', import.meta.url)));
const MODELO_MOTOS = JSON.parse(fs.readFileSync(new URL('../plantillas-empresa/importacion-motos.json', import.meta.url)));

test('el bus apunta la hora del reloj de la oficina, no la del ordenador', () => {
  const bus = crearBus({ reloj: () => Date.UTC(2030, 0, 1) });
  bus.publicar('x', {});
  assert.equal(bus.ultimos()[0].fecha, '2030-01-01T00:00:00.000Z');
});

test('parecido: erratas, orden de palabras y M6 frente a M8', () => {
  assert.ok(parecidoEdicion('TOR-M6-30', 'TOR-M6-3O') > 0.85);
  assert.ok(parecidoTrigramas('Tornillo M8x40 zincado', 'zincado tornillo M8x40') > 0.8);
  const p = buscarParecido({ ref: 'CL-4471', descripcion: 'Tornillo M8x40 zinc' }, ESPACIO.catalogo);
  assert.equal(p.ref, 'TOR-M8-40');
  assert.equal(p.por, 'descripcion');
  // Una letra distinta puede ser otro producto: el parecido es alto, por eso por defecto solo se propone
  assert.ok(parecidoEdicion('TOR-M6-30', 'TOR-M8-30') > 0.85);
});

function oficina(config = {}, reloj) {
  return crearOficina({ id: 'pedidos', nombre: 'Pedidos', plantilla: pedido, almacen: crearMemoria({ ...ESPACIO, ...config }), reloj });
}

test('cruce aproximado: propone con su puntuación y la persona lo acepta con un clic', async () => {
  const of = oficina();
  const e = await of.entrar({ de: 'compras@ferreteria-sol.test', asunto: 'Pedido PO-9', texto: 'Pedido nº PO-9\nCL-4471    Tornillo M8x40 zinc    100\nTUE-M6    Tuerca M6    50' });
  const a = e.avisos.find((x) => x.tipo === 'referencia');
  assert.equal(a.propuesta, 'TOR-M8-40');
  assert.ok(a.puntuacion >= 0.6 && a.puntuacion < 1);
  assert.equal(e.datos.lineas[1].cruce, 'exacto');
  const r = await of.aprobar(e.id, { aceptar_propuestas: true });
  assert.equal(r.estado, 'registrado');
  assert.equal(r.datos.lineas[0].producto, 'TOR-M8-40');
  assert.equal(r.datos.lineas[0].cruce, 'persona');
  assert.equal(r.correcciones, 1);
  // Aprendido: la próxima vez el mismo cliente no necesita a nadie para esa referencia
  const e2 = await of.entrar({ de: 'compras@ferreteria-sol.test', asunto: 'Pedido PO-10', texto: 'Pedido nº PO-10\nCL-4471    Tornillo    30' });
  assert.equal(e2.avisos.length, 0);
  assert.equal(e2.datos.lineas[0].cruce, 'aprendido');
});

test('cruce automático solo si el espacio lo activa y el segundo candidato queda lejos', async () => {
  const of = oficina({ cruce: { auto: 0.9 }, automatico: ['sol'] });
  const e = await of.entrar({ de: 'compras@ferreteria-sol.test', asunto: 'Pedido PO-11', texto: 'Pedido nº PO-11\nBIS-1000    Bisagra acero 100 mm    10' });
  assert.equal(e.estado, 'registrado');
  assert.equal(e.datos.lineas[0].producto, 'BIS-100');
  assert.equal(e.datos.lineas[0].cruce, 'parecido');
});

test('métricas y tablero de proceso con un reloj que se adelanta', async () => {
  let t = Date.UTC(2027, 0, 4, 9);
  const of = oficina({ automatico: ['sol'] }, () => t);
  await of.entrar({ de: 'compras@ferreteria-sol.test', asunto: 'Pedido PO-1', texto: 'Pedido nº PO-1\nTUE-M6  Tuerca  50' }); // pasa solo
  const e = await of.entrar({ de: 'compras@distribuciones-levante.test', asunto: 'Pedido PO-2', texto: 'Pedido nº PO-2\nTUE-M6  Tuerca  50' });
  t += 45 * 60e3; // la persona tarda 45 minutos en mirarlo
  await of.aprobar(e.id, {}, 'Ana');
  const m = await of.metricas();
  assert.equal(m.registrados, 2);
  assert.equal(m.sin_tocar_pct, 50);
  assert.equal(m.aprobados_tal_cual_pct, 50);
  assert.equal(m.espera_supervision_min.p50, 45);
  const p = await of.proceso();
  assert.equal(p.cuello.id, 'supervision');
  assert.ok(p.transiciones.some((x) => x.de === 'gestion' && x.a === 'supervision'));
});

test('OCEL 2.0: objetos, eventos y el enlace Pedidos → Producción', async () => {
  const bus = crearBus();
  const mem = crearMemoria({ ...ESPACIO, automatico: true });
  const ofP = crearOficina({ id: 'pedidos', nombre: 'Pedidos', plantilla: pedido, almacen: mem, bus });
  const ofR = crearOficina({ id: 'produccion', nombre: 'Producción', plantilla: produccion, almacen: crearMemoria({ ...ESPACIO, automatico: true }), bus });
  await ofP.entrar({ de: 'compras@ferreteria-sol.test', asunto: 'Pedido PO-3', texto: 'Pedido nº PO-3\nTOR-M6-30  Tornillo  500' });
  await bus.calma();
  const o = aOcel([...(await ofP.listar()), ...(await ofR.listar())]);
  for (const k of ['objectTypes', 'eventTypes', 'objects', 'events']) assert.ok(Array.isArray(o[k]), k);
  assert.ok(o.objects.some((x) => x.id === 'cliente:sol'));
  assert.ok(o.objects.some((x) => x.id === 'producto:TOR-M6-30'));
  const orden = o.objects.find((x) => x.type !== 'pedido' && x.type !== 'cliente' && x.type !== 'producto');
  assert.ok(orden.relationships.some((r) => r.qualifier === 'viene de' && r.objectId.startsWith('pedido:')));
  assert.ok(o.events.every((ev) => ev.time && ev.relationships.length));
  assert.ok(o.events.every((ev, i) => i === 0 || Date.parse(o.events[i - 1].time) <= Date.parse(ev.time)));
});

test('azar con semilla: misma semilla, mismos números', () => {
  const a = crearAzar(5), b = crearAzar(5);
  assert.deepEqual([a.u(), a.valor({ min: 1, probable: 2, max: 3 })], [b.u(), b.valor({ min: 1, probable: 2, max: 3 })]);
});

test('modo simulación: un trimestre de pedidos falsos, manual frente a Ada', async () => {
  const base = { espacio: MODELO_OFICINA.espacio, modelo: MODELO_OFICINA.simulacion, semilla: 11, dias: 90 };
  const manual = await simular({ ...base, escenario: 'manual' });
  const ada = await simular({ ...base, escenario: 'ada' });
  assert.equal(manual.pedidos, ada.pedidos, 'los dos escenarios ven los mismos pedidos');
  assert.ok(manual.pedidos > 500);
  assert.ok(ada.horas_persona_ano < manual.horas_persona_ano / 2, 'Ada quita más de la mitad de las horas');
  assert.ok(ada.error_lineas_pct < manual.error_lineas_pct);
  assert.ok(ada.metricas.sin_tocar_pct > 0);
  assert.equal(ada.metricas.ia_usd, 0, 'la simulación no gasta IA');
  const otra = await simular({ ...base, escenario: 'ada' });
  assert.equal(otra.horas_persona_ano, ada.horas_persona_ano, 'reproducible con la misma semilla');
});

test('Montecarlo de la oficina: rangos y ahorro', async () => {
  const r = await montecarlo({ espacio: MODELO_OFICINA.espacio, modelo: MODELO_OFICINA.simulacion, replicas: 3, dias: 30 });
  assert.ok(r.ahorro.horas_mes.p50 > 0);
  assert.ok(r.ahorro.euros_ano.p50 > 0);
  assert.ok(r.escenarios.ada.sin_tocar_pct.p50 >= 0);
});

test('empresa desde cero (caso motos): mismos órdenes de magnitud que el informe del 22/11', () => {
  const r = simularEmpresa(MODELO_MOTOS, { iteraciones: 3000 });
  const c = r.resultados.coste_puesta_ud.p50;
  assert.ok(c > 900 && c < 1100, `coste por moto ${c}`);
  assert.ok(r.punto_equilibrio_ud_mes > 15 && r.punto_equilibrio_ud_mes < 22);
  assert.ok(r.probabilidad_perdidas_ano1_pct > 50);
  const [primera] = Object.keys(r.sensibilidad);
  assert.ok(['ventas_por_tienda_mes', 'tiendas_finales'].includes(primera), 'lo que más pesa es la red comercial');
  assert.ok(r.supuestos.find((s) => s.variable === 'arancel_pct').fuente.includes('TARIC'));
  assert.ok(r.sin_fuente.includes('seguro_pct'));
});
