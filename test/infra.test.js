import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// visual/infra.js es un script de navegador: se carga en un contexto aparte
const ctx = { globalThis: {} };
ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../visual/infra.js', import.meta.url), 'utf8'), ctx);
const { aDatos } = ctx.AdaInfra;

test('agrupa por tipo y el peor estado manda', () => {
  const d = aDatos([
    { id: 'a', tipo: 'bd', nombre: 'ERP', estado: 'ok' },
    { id: 'b', tipo: 'bd', nombre: 'DW', estado: 'aviso', detalle: 'Espacio 91 %' },
    { id: 'c', tipo: 'ejecucion', nombre: 'ETL', estado: 'error', detalle: 'timeout' },
    { id: 'd', tipo: 'red', nombre: 'S:', estado: 'ok' },
  ]);
  const w = Object.fromEntries(d.trabajadores.map((x) => [x.id, x]));
  assert.equal(w['infra-bd'].estado, 'aviso');
  assert.equal(w['infra-bd'].cifra, 1);
  assert.equal(w['infra-bd'].frase, 'DW: Espacio 91 %');
  assert.equal(w['infra-ejecucion'].estado, 'error');
  assert.equal(w['infra-red'].estado, 'ok');
  assert.equal(d.ada.estado, 'error');
  assert.equal(d.resumen.error, 1);
  assert.equal(d.resumen.aviso, 1);
});

test('sin señales a tiempo pasa a aviso', () => {
  const ahora = Date.parse('2026-10-27T10:00:00Z');
  const d = aDatos([{ id: 'j', tipo: 'ejecucion', nombre: 'Cubo', estado: 'ok', cuando: '2026-10-27T08:00:00Z' }], { ahora, caducaMin: 30 });
  assert.equal(d.trabajadores[0].estado, 'aviso');
  assert.match(d.trabajadores[0].frase, /Sin datos desde hace 120 min/);
});

test('tipo desconocido va a servidores y todo apagado es pausa', () => {
  const d = aDatos([{ id: 'x', tipo: 'raro', nombre: 'X', estado: 'apagado' }]);
  assert.equal(d.trabajadores[0].id, 'infra-servicio');
  assert.equal(d.trabajadores[0].estado, 'pausa');
  assert.equal(d.ada.estado, 'ok');
});
