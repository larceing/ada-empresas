#!/usr/bin/env node
// Uso:
//   node src/simulacion/cli.js oficina plantillas-empresa/distribuidor-tornilleria.json [--replicas 20] [--ocel salida.json]
//   node src/simulacion/cli.js empresa plantillas-empresa/importacion-motos.json [--iteraciones 10000]
//   node src/simulacion/cli.js ocel /datos/<espacio> salida.json      (lo real de un espacio, todas sus oficinas)
import fs from 'node:fs';
import { montecarlo } from './montecarlo.js';
import { simular } from './motor.js';
import { simularEmpresa } from './empresa.js';
import { aOcel } from '../nucleo/ocel.js';

const [, , que, fichero, ...resto] = process.argv;
const opt = (k, d) => { const i = resto.indexOf(`--${k}`); return i >= 0 ? resto[i + 1] : d; };
if (!que || !fichero) { console.error('Uso: cli.js oficina|empresa <modelo.json> [--replicas N] [--iteraciones N] [--ocel salida.json]'); process.exit(2); }
if (que === 'ocel') {
  const path = await import('node:path');
  const exps = [];
  for (const d of fs.readdirSync(fichero, { withFileTypes: true })) {
    const f = path.join(fichero, d.name, 'expedientes.json');
    if (d.isDirectory() && fs.existsSync(f)) exps.push(...JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  const salida = resto[0] || 'ocel.json';
  fs.writeFileSync(salida, JSON.stringify(aOcel(exps)));
  console.error(`${exps.length} expedientes → OCEL 2.0 en ${salida}`);
  process.exit(0);
}
const modelo = JSON.parse(fs.readFileSync(fichero, 'utf8'));

if (que === 'oficina') {
  const replicas = Number(opt('replicas', 20));
  const r = await montecarlo({ espacio: modelo.espacio, modelo: modelo.simulacion || {}, replicas, alAvanzar: (i, n) => process.stderr.write(`\r${i}/${n}`) });
  process.stderr.write('\n');
  delete r.crudo;
  console.log(JSON.stringify(r, null, 1));
  const ocel = opt('ocel');
  if (ocel) {
    const s = await simular({ espacio: modelo.espacio, modelo: modelo.simulacion || {}, escenario: 'ada', semilla: 1 });
    fs.writeFileSync(ocel, JSON.stringify(aOcel(await s.expedientes(), { nombresOficina: { pedidos: 'Pedidos' } })));
    console.error(`OCEL 2.0 en ${ocel}`);
  }
} else if (que === 'empresa') {
  const r = simularEmpresa(modelo, { iteraciones: Number(opt('iteraciones', 10000)), semilla: Number(opt('semilla', 2026)) });
  console.log(JSON.stringify(r, null, 1));
} else { console.error(`No sé simular «${que}»`); process.exit(2); }
