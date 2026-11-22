import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearDestinos } from '../src/node/destinos/index.js';
import { crearOficina } from '../src/nucleo/oficina.js';
import { crearMemoria } from '../src/nucleo/memoria.js';
import * as pedido from '../src/nucleo/plantillas/pedido.js';

const CONFIG = {
  clientes: [{ id: 'sol', nombre: 'Ferretería Sol SL', dominios: ['ferreteria-sol.test'], ids: { holded: 'c-holded-9', odoo: 41, bc: 'C00010', sage: '430001' } }],
  catalogo: [{ ref: 'TOR-M6-30', nombre: 'Tornillo M6x30', ids: { odoo: 7, bc: '1000' } }, { ref: 'TUE-M6', nombre: 'Tuerca M6' }],
};
const EXP = { id: 'abcd1234-0001', recibido: '2026-11-22T09:00:00.000Z', cliente: { id: 'sol', nombre: 'Ferretería Sol SL' },
  datos: { numero_pedido: 'PO-1', fecha_entrega: '12/12/2026', direccion_entrega: 'Nave 3', lineas: [{ ref: 'TOR-M6-30', producto: 'TOR-M6-30', cantidad: 500, precio: 0.08 }, { ref: 'X-9', producto: 'TUE-M6', cantidad: 100, precio: null }] } };
const ENV = { SINDRI_LLAVE: 'sdi_prueba', HOLDED_CLAVE: 'h-prueba', ODOO_CLAVE: 'o-prueba', BC_SECRETO: 's-prueba' };

function fetchFalso(respuestas) {
  const llamadas = [];
  const f = async (url, o) => {
    llamadas.push({ url, ...o, cuerpo: o.body && o.body.startsWith('{') ? JSON.parse(o.body) : o.body });
    const r = respuestas(url, llamadas.at(-1));
    return { ok: (r.estado || 200) < 400, status: r.estado || 200, text: async () => JSON.stringify(r.json ?? {}) };
  };
  f.llamadas = llamadas;
  return f;
}
const almacen = crearMemoria(CONFIG);

test('Sindri: llave por variable de entorno, idempotencia y líneas', async () => {
  const f = fetchFalso(() => ({ json: { numero: 'PV-2026-0042' } }));
  const { sindri } = crearDestinos({ sindri: { url: 'https://dev.ejemplo.test/', llave_env: 'SINDRI_LLAVE' } }, almacen, { fetchFn: f, env: ENV });
  const r = await sindri.registrar(EXP);
  assert.equal(r.referencia, 'PV-2026-0042');
  const [c] = f.llamadas;
  assert.equal(c.url, 'https://dev.ejemplo.test/sindri/api/integracion/v1/pedidos');
  assert.equal(c.headers.Authorization, 'Bearer sdi_prueba');
  assert.equal(c.headers['Idempotency-Key'], EXP.id);
  assert.equal(c.cuerpo.fecha_entrega, '2026-12-12');
  assert.deepEqual(c.cuerpo.lineas.map((l) => [l.producto, l.cantidad]), [['TOR-M6-30', 500], ['TUE-M6', 100]]);
});

test('Sindri sin llave: incidencia clara, sin llamar', async () => {
  const f = fetchFalso(() => ({}));
  const { sindri } = crearDestinos({ sindri: { url: 'https://x.test', llave_env: 'NO_EXISTE' } }, almacen, { fetchFn: f, env: {} });
  await assert.rejects(sindri.registrar(EXP), (e) => e.tipo === 'destino' && /NO_EXISTE/.test(e.message));
  assert.equal(f.llamadas.length, 0);
});

test('Holded: salesorder con el contacto del cliente', async () => {
  const f = fetchFalso(() => ({ json: { status: 1, id: 'doc-77' } }));
  const { holded } = crearDestinos({ holded: { clave_env: 'HOLDED_CLAVE' } }, almacen, { fetchFn: f, env: ENV });
  assert.equal((await holded.registrar(EXP)).referencia, 'doc-77');
  const [c] = f.llamadas;
  assert.equal(c.url, 'https://api.holded.com/api/invoicing/v1/documents/salesorder');
  assert.equal(c.headers.key, 'h-prueba');
  assert.equal(c.cuerpo.contactId, 'c-holded-9');
  assert.deepEqual(c.cuerpo.items.map((i) => [i.name, i.units]), [['Tornillo M6x30', 500], ['Tuerca M6', 100]]);
});

test('Odoo: login, busca el producto que no tiene id y crea sale.order', async () => {
  const f = fetchFalso((_u, c) => {
    const p = c.cuerpo.params;
    if (p.method === 'login') return { json: { result: 5 } };
    if (p.args[3] === 'product.product') return { json: { result: [12] } };
    if (p.args[3] === 'sale.order') return { json: { result: 901 } };
    return { json: { result: null } };
  });
  const { odoo } = crearDestinos({ odoo: { url: 'https://odoo.test', base_datos: 'demo', usuario: 'ada', clave_env: 'ODOO_CLAVE' } }, almacen, { fetchFn: f, env: ENV });
  assert.equal((await odoo.registrar(EXP)).referencia, 'sale.order/901');
  const crear = f.llamadas.at(-1).cuerpo.params.args;
  assert.equal(crear[5][0].partner_id, 41);
  assert.deepEqual(crear[5][0].order_line.map((l) => l[2].product_id), [7, 12]);
});

test('Business Central: deep insert de salesOrders', async () => {
  const f = fetchFalso((url) => (url.includes('oauth2') ? { json: { access_token: 'tok', expires_in: 3600 } } : { json: { number: 'S-ORD101005' } }));
  const { bc } = crearDestinos({ bc: { tipo: 'business-central', tenant: 't1', empresa: 'e1', cliente_id: 'app', secreto_cliente_env: 'BC_SECRETO' } }, almacen, { fetchFn: f, env: ENV });
  assert.equal((await bc.registrar(EXP)).referencia, 'S-ORD101005');
  const c = f.llamadas.at(-1);
  assert.equal(c.url, 'https://api.businesscentral.dynamics.com/v2.0/t1/production/api/v2.0/companies(e1)/salesOrders');
  assert.equal(c.headers.Authorization, 'Bearer tok');
  assert.equal(c.cuerpo.customerNumber, 'C00010');
  assert.deepEqual(c.cuerpo.salesOrderLines.map((l) => l.lineObjectNumber), ['1000', 'TUE-M6']);
});

test('Fichero (Sage, A3): CSV con «;» y coma decimal', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ada-fichero-'));
  const { sage } = crearDestinos({ sage: { tipo: 'fichero', erp: 'sage', carpeta: dir } }, almacen);
  const r = await sage.registrar(EXP);
  const t = fs.readFileSync(path.join(dir, r.referencia), 'utf8');
  assert.match(t, /430001;PO-1;12\/12\/2026;Nave 3;TOR-M6-30;500;0,08;TOR-M6-30;abcd1234-0001/);
});

test('un fallo del ERP acaba en Incidencias y se reintenta', async () => {
  let caido = true;
  const f = fetchFalso(() => (caido ? { estado: 503, json: { error: 'mantenimiento' } } : { json: { numero: 'PV-1' } }));
  const mem = crearMemoria({ ...CONFIG, destino: 'sindri', automatico: ['sol'] });
  const of = crearOficina({ id: 'pedidos', nombre: 'Pedidos', plantilla: pedido, almacen: mem, herramientas: { destinos: crearDestinos({ sindri: { url: 'https://x.test', llave_env: 'SINDRI_LLAVE' } }, mem, { fetchFn: f, env: ENV }) } });
  const e = await of.entrar({ de: 'compras@ferreteria-sol.test', asunto: 'Pedido PO-55', texto: 'Pedido nº PO-55\nTOR-M6-30  Tornillo  500' });
  assert.equal(e.estado, 'incidencia');
  assert.match(e.incidencia.mensaje, /Sindri respondió 503: mantenimiento/);
  caido = false;
  const r = await of.reintentar(e.id);
  assert.equal(r.estado, 'registrado');
  assert.equal(r.registro.referencia, 'PV-1');
});
