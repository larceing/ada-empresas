import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearOficina } from '../src/nucleo/oficina.js';
import { crearMemoria } from '../src/nucleo/memoria.js';
import { crearBus } from '../src/nucleo/bus.js';
import * as comercial from '../src/nucleo/plantillas/comercial.js';
import * as pedido from '../src/nucleo/plantillas/pedido.js';
import * as produccion from '../src/nucleo/plantillas/produccion.js';
import * as planta from '../src/nucleo/plantillas/planta.js';
import { ESPACIO } from '../banco/generar.js';

test('cadena completa: Comercial → Pedidos → Producción → Planta', async () => {
  const bus = crearBus();
  const altas = [];
  const espacio = { ...ESPACIO, planta: { materiales: { 'TOR-M8-40': { material: 'ALAMBRE-8', por_ud: 0.05 } }, stock: { 'ALAMBRE-8': 10 } } };
  const memorias = { comercial: crearMemoria(espacio), pedidos: crearMemoria(espacio), produccion: crearMemoria({ ...espacio, automatico: true }), planta: crearMemoria(espacio) };
  // El ERP de mentira: da de alta el cliente nuevo y se lo cuenta a todas las oficinas
  const sindri = { async registrar(exp) {
    if (exp.tipo === 'oportunidad' && !exp.cliente) {
      const cl = { id: 'nuevo-1', nombre: exp.datos.cliente_nuevo.nombre };
      for (const m of Object.values(memorias)) { const c = await m.config(); c.clientes.push(cl); await m.guardarConfig(c); }
      exp.cliente = cl; altas.push(cl);
    }
    return { referencia: `${exp.tipo}-${exp.id.slice(0, 4)}` };
  } };
  const of = (id, plantilla) => crearOficina({ id, nombre: id, plantilla, bus, almacen: memorias[id], herramientas: { destinos: { sindri } } });
  for (const m of Object.values(memorias)) { const c = await m.config(); c.destino = 'sindri'; await m.guardarConfig(c); }
  const oComercial = of('comercial', comercial), oPedidos = of('pedidos', pedido), oProduccion = of('produccion', produccion), oPlanta = of('planta', planta);

  const op = await oComercial.entrar({ canal: 'Brokkr', ganada: true, titulo: 'Tornillería para obra', cliente_nuevo: { nombre: 'Montajes Elda SL' }, lineas: [{ producto: 'TOR-M8-40', cantidad: 400 }] });
  assert.equal(op.estado, 'por_revisar');
  assert.equal(op.avisos[0].tipo, 'cliente_nuevo');
  await oComercial.aprobar(op.id, { alta: true }, 'Jefa comercial');
  await bus.calma();
  assert.equal(altas.length, 1);

  const [p] = await oPedidos.listar();
  assert.equal(p.entrada.canal, 'Brokkr');
  assert.equal(p.cliente.id, 'nuevo-1');
  assert.equal(p.estado, 'por_revisar', 'Pedidos siempre pide el OK si no hay piloto');
  assert.deepEqual(p.avisos, []);
  await oPedidos.aprobar(p.id, {}, 'Supervisión de pedidos');
  await bus.calma();

  const [o] = await oProduccion.listar();
  assert.equal(o.estado, 'registrado');
  const [f] = await oPlanta.listar();
  assert.equal(f.estado, 'por_revisar');
  assert.match(f.avisos[0].texto, /Falta material: ALAMBRE-8 \(hacen 20, hay 10\)/);
  const ok = await oPlanta.aprobar(f.id, { material_pedido: true }, 'Jefe de planta');
  assert.equal(ok.estado, 'registrado');
  for (const e of planta.estadosSeguimiento) await oPlanta.seguir(f.id, e);
  assert.equal((await oPlanta.obtener(f.id)).seguimiento, 'albaran');
  const eventos = bus.ultimos().map((e) => e.evento);
  for (const ev of ['comercial.registrado', 'pedidos.registrado', 'produccion.registrado', 'planta.registrado', 'planta.albaran']) assert.ok(eventos.includes(ev), ev);
});
