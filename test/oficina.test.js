import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearOficina } from '../src/nucleo/oficina.js';
import { crearMemoria } from '../src/nucleo/memoria.js';
import { crearBus } from '../src/nucleo/bus.js';
import * as pedido from '../src/nucleo/plantillas/pedido.js';
import * as produccion from '../src/nucleo/plantillas/produccion.js';
import { leerCorreo } from '../src/node/correo.js';
import { leerAdjunto } from '../src/node/extraer.js';
import { crearIA } from '../src/node/ia.js';
import { crearAlmacen } from '../src/node/almacen.js';
import { conectarWebhooks } from '../src/node/webhooks.js';
import { CORREOS, ESPACIO, eml } from '../banco/generar.js';

const correo = (archivo) => leerCorreo(eml(CORREOS.find((c) => c.archivo.startsWith(archivo))));
function oficinaPedidos(extra = {}) {
  return crearOficina({ id: 'pedidos', nombre: 'Pedidos', plantilla: pedido, almacen: crearMemoria({ ...ESPACIO, ...(extra.config || {}) }), herramientas: { leerAdjunto, ...(extra.herramientas || {}) }, bus: extra.bus });
}

test('números en formato español', () => {
  assert.equal(pedido.numero('2.000'), 2000);
  assert.equal(pedido.numero('1.234,50'), 1234.5);
  assert.equal(pedido.numero('0,08'), 0.08);
  assert.equal(pedido.numero('240'), 240);
  assert.equal(pedido.numero('M8'), null);
});

test('líneas de un PDF con columnas apretadas', () => {
  const l = pedido.lineasDe('Referencia Descripcion Cantidad Precio\nTOR-M6-30 Tornillo M6x30            500    0,08\n1 ARA-M6 Arandela 1.000');
  assert.deepEqual(l.map((x) => [x.ref, x.cantidad, x.precio]), [['TOR-M6-30', 500, 0.08], ['ARA-M6', 1000, null]]);
});

test('el correo .eml se lee con su adjunto', () => {
  const e = correo('02');
  assert.equal(e.de, 'pedidos@ferreteria-sol.test');
  assert.equal(e.asunto, 'Pedido de compra PO-77812');
  assert.equal(e.adjuntos[0].nombre, 'PO-77812.pdf');
  assert.ok(e.adjuntos[0].datos.length > 200);
});

test('banco: cada correo acaba donde toca', async () => {
  const of = oficinaPedidos();
  const r = {};
  for (const c of CORREOS) {
    const e = leerCorreo(eml(c));
    r[c.archivo.slice(0, 2)] = await of.entrar(e, { clave: e.message_id });
  }
  assert.equal(r['01'].estado, 'por_revisar');
  assert.deepEqual(r['01'].avisos.map((a) => a.ref), ['CL-4471', 'CL-4480']);
  assert.equal(r['01'].datos.numero_pedido, '2026-0381');
  assert.equal(r['01'].cliente.id, 'levante');
  // PDF con texto: todo cuadra con el catálogo, solo falta el OK
  assert.equal(r['02'].avisos.length, 0);
  assert.equal(r['02'].datos.lineas.length, 3);
  assert.equal(r['02'].datos.fecha_entrega, '12/11/2026');
  assert.equal(r['02'].entrada.adjuntos[0].metodo, 'pdf-texto');
  assert.equal(r['02'].entrada.adjuntos[0].datos, undefined, 'el binario no se guarda');
  // Excel
  assert.equal(r['03'].entrada.adjuntos[0].metodo, 'excel');
  assert.deepEqual(r['03'].datos.lineas.map((l) => [l.ref, l.cantidad]), [['NOR-118', 240], ['NOR-120', 120]]);
  // Factura: Recepción la aparta
  assert.equal(r['04'].estado, 'no_corresponde');
  // Remitente desconocido
  assert.ok(r['06'].avisos.some((a) => a.tipo === 'cliente'));
  // Escaneado: se ve el número en el asunto y se avisa del OCR
  assert.equal(r['07'].datos.numero_pedido, 'PO-77813');
  assert.ok(r['07'].avisos.some((a) => a.tipo === 'lectura'));
  // Consulta: dudosa, a Supervisión
  assert.ok(r['08'].avisos.some((a) => a.tipo === 'clase'));
  const t = await of.tablero();
  assert.equal(t.total, 8);
  assert.equal(t.por_estado.no_corresponde, 1);
});

test('el mismo correo no entra dos veces', async () => {
  const of = oficinaPedidos();
  const e = correo('01');
  await of.entrar(e, { clave: e.message_id });
  const otra = await of.entrar(e, { clave: e.message_id });
  assert.equal(otra.omitido, true);
});

test('Supervisión corrige, la oficina aprende y detecta el duplicado reenviado', async () => {
  const of = oficinaPedidos();
  const a = await of.entrar(correo('01'));
  await assert.rejects(() => of.aprobar(a.id, { productos: { 'CL-4471': 'NO-EXISTE' } }), /no está en el catálogo/);
  const parcial = await of.aprobar(a.id, { productos: { 'CL-4471': 'TOR-M8-40' } }, 'Marta (supervisora)');
  assert.equal(parcial.estado, 'por_revisar');
  assert.equal(parcial.avisos.length, 1);
  const ok = await of.aprobar(a.id, { productos: { 'CL-4480': 'ARA-M8' } }, 'Marta (supervisora)');
  assert.equal(ok.estado, 'registrado');
  assert.equal(ok.puesto, 'seguimiento');
  assert.deepEqual(ok.datos.lineas.map((l) => l.producto), ['TOR-M8-40', 'ARA-M8']);
  assert.ok(ok.historial.some((h) => h.quien === 'Marta (supervisora)' && h.que === 'aprobado'));
  // El reenvío ya sabe las referencias, pero es un duplicado
  const b = await of.entrar(correo('05'));
  assert.deepEqual(b.datos.lineas.map((l) => l.producto), ['TOR-M8-40', 'ARA-M8']);
  assert.deepEqual(b.avisos.map((x) => x.tipo), ['duplicado']);
  await of.descartar(b.id, 'Reenvío del 2026-0381');
  assert.equal((await of.obtener(b.id)).estado, 'descartado');
});

test('piloto automático: lo limpio de un cliente con piloto pasa solo', async () => {
  const of = oficinaPedidos({ config: { automatico: ['sol'] } });
  const exp = await of.entrar(correo('02'));
  assert.equal(exp.estado, 'registrado');
  assert.ok(exp.historial.some((h) => h.que === 'pasa solo'));
});

test('seguimiento en orden', async () => {
  const of = oficinaPedidos({ config: { automatico: ['sol'] } });
  const exp = await of.entrar(correo('02'));
  await assert.rejects(() => of.seguir(exp.id, 'servido'), /siguiente paso es «confirmado»/);
  await of.seguir(exp.id, 'confirmado');
  const s = await of.seguir(exp.id, 'en_produccion');
  assert.equal(s.seguimiento, 'en_produccion');
});

test('Incidencias: si el ERP falla, se apunta y se reintenta desde Registro', async () => {
  let fallar = true;
  const destinos = { sindri: { async registrar() { if (fallar) throw Object.assign(new Error('Sindri no responde'), { tipo: 'destino' }); return { referencia: 'PED-0001' }; } } };
  const of = oficinaPedidos({ config: { automatico: ['sol'], destino: 'sindri' }, herramientas: { destinos } });
  const exp = await of.entrar(correo('02'));
  assert.equal(exp.estado, 'incidencia');
  assert.equal(exp.incidencia.puesto, 'registro');
  assert.equal(exp.incidencia.tipo, 'destino');
  fallar = false;
  const otra = await of.reintentar(exp.id);
  assert.equal(otra.estado, 'registrado');
  assert.equal(otra.registro.referencia, 'PED-0001');
});

test('varias oficinas: Producción recibe los pedidos registrados', async () => {
  const bus = crearBus();
  const pedidos = oficinaPedidos({ bus, config: { automatico: ['sol'] } });
  const prod = crearOficina({ id: 'produccion', nombre: 'Producción', plantilla: produccion, bus,
    almacen: crearMemoria({ ...ESPACIO, automatico: true, produccion: { stock: { 'TUE-M6': 200 } } }) });
  const p = await pedidos.entrar(correo('02'));
  await bus.calma();
  const ordenes = await prod.listar();
  assert.equal(ordenes.length, 1);
  const o = ordenes[0];
  assert.equal(o.estado, 'registrado');
  assert.equal(o.datos.pedido.id, p.id);
  assert.deepEqual(o.datos.servir, [{ producto: 'TUE-M6', cantidad: 200 }]);
  assert.deepEqual(o.datos.fabricar.map((f) => [f.producto, f.cantidad]), [['TOR-M6-30', 500], ['TUE-M6', 300], ['ARA-M6', 1000]]);
  assert.ok(bus.ultimos().some((e) => e.evento === 'produccion.registrado'));
});

test('IA: solo entra cuando las reglas no bastan, y respeta el tope', async () => {
  const almacen = crearMemoria(ESPACIO);
  let llamadas = 0;
  const respuesta = { no_corresponde: true, numero_pedido: null, fecha_entrega: null, direccion_entrega: null, lineas: [] };
  const fetchFn = async () => { llamadas += 1; return { ok: true, json: async () => ({ usage: { prompt_tokens: 900, completion_tokens: 40 }, choices: [{ message: { content: JSON.stringify(respuesta) } }] }) }; };
  almacen.gastoMes = async () => 0;
  almacen.sumarGasto = async () => {};
  const ia = crearIA({ almacen, clave: 'prueba', fetchFn });
  const of = crearOficina({ id: 'pedidos', nombre: 'Pedidos', plantilla: pedido, almacen, herramientas: { leerAdjunto, ia } });
  const limpio = await of.entrar(correo('02'));
  assert.equal(llamadas, 0, 'el PDF con texto no necesita IA');
  assert.equal(limpio.ia, null);
  const consulta = await of.entrar(correo('08'));
  assert.equal(llamadas, 1);
  assert.equal(consulta.estado, 'no_corresponde');
  // Tope alcanzado: no se llama y queda anotado
  almacen.gastoMes = async () => 9;
  const otra = await of.entrar(correo('07'));
  assert.equal(llamadas, 1);
  assert.ok(otra.historial.some((h) => /Tope de IA/.test(h.detalle || '')));
});

test('sin clave no hay IA', () => {
  assert.equal(crearIA({ almacen: crearMemoria(), clave: '' }), null);
});

test('almacén en ficheros: separa espacios y oficinas', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ada-'));
  const a = crearAlmacen(raiz, 'cliente-a', 'pedidos');
  const b = crearAlmacen(raiz, 'cliente-b', 'pedidos');
  await a.guardarEspacio(ESPACIO);
  const of = crearOficina({ id: 'pedidos', nombre: 'Pedidos', plantilla: pedido, almacen: a, herramientas: { leerAdjunto } });
  await of.entrar(correo('01'));
  assert.equal((await a.listar()).length, 1);
  assert.equal((await b.listar()).length, 0);
  assert.throws(() => crearAlmacen(raiz, '../fuera', 'pedidos'));
  await a.sumarGasto(0.0123);
  assert.equal(await a.gastoMes(), 0.0123);
  fs.rmSync(raiz, { recursive: true, force: true });
});

test('webhooks: cada evento sale firmado', async () => {
  const bus = crearBus();
  const enviados = [];
  conectarWebhooks(bus, { espacio: 'demo', webhooks: () => [{ url: 'https://ejemplo.test/h', secreto: 's' }], fetchFn: async (url, o) => { enviados.push(o); return { ok: true }; } });
  const of = oficinaPedidos({ bus, config: { automatico: ['sol'] } });
  await of.entrar(correo('02'));
  await bus.calma();
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].headers['X-Ada-Evento'], 'pedidos.registrado');
  assert.match(enviados[0].headers['X-Ada-Firma'], /^[0-9a-f]{64}$/);
});
