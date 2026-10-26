// Pasa el banco de pruebas por una oficina de Pedidos (sin IA) y enseña qué hace cada puesto.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearOficina } from '../src/nucleo/oficina.js';
import { crearMemoria } from '../src/nucleo/memoria.js';
import * as pedido from '../src/nucleo/plantillas/pedido.js';
import { leerCorreo } from '../src/node/correo.js';
import { leerAdjunto } from '../src/node/extraer.js';
import { ESPACIO } from './generar.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'correos');
const of = crearOficina({ id: 'pedidos', nombre: 'Pedidos', plantilla: pedido, almacen: crearMemoria(ESPACIO), herramientas: { leerAdjunto } });
for (const f of fs.readdirSync(dir).sort()) {
  const e = leerCorreo(fs.readFileSync(path.join(dir, f)));
  const exp = await of.entrar(e, { clave: e.message_id });
  console.log(`\n${f} → ${exp.estado} (${exp.puesto})`);
  if (exp.datos) console.log('  ', JSON.stringify({ n: exp.datos.numero_pedido, entrega: exp.datos.fecha_entrega, dir: exp.datos.direccion_entrega, lineas: exp.datos.lineas.map((l) => `${l.ref}=${l.producto}x${l.cantidad}${l.precio != null ? '@' + l.precio : ''}`) }));
  for (const a of exp.avisos) console.log('   !', a.texto);
  if (exp.entrada.adjuntos.length) console.log('   adjuntos:', exp.entrada.adjuntos.map((a) => `${a.nombre}:${a.metodo}`).join(', '));
}
