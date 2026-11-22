// Monta los destinos de un espacio a partir de su config: { destinos: { sindri: { tipo: 'sindri', url, llave_env } } }.
// La oficina usa config.destino para saber a cuál manda. Un destino nuevo = un archivo en esta carpeta.
import { crearSindri } from './sindri.js';
import { crearHolded } from './holded.js';
import { crearOdoo } from './odoo.js';
import { crearBusinessCentral } from './business-central.js';
import { crearFichero } from './fichero.js';

export const TIPOS = { sindri: crearSindri, holded: crearHolded, odoo: crearOdoo, 'business-central': crearBusinessCentral, fichero: crearFichero };

/**
 * @param {object} definiciones  config.destinos del espacio
 * @param {object} almacen       para pasar clientes y catálogo (con sus ids en cada ERP) al destino
 */
export function crearDestinos(definiciones = {}, almacen, opciones = {}) {
  const out = {};
  for (const [nombre, cfg] of Object.entries(definiciones)) {
    const crear = TIPOS[cfg.tipo || nombre];
    if (!crear) throw new Error(`Destino desconocido: ${cfg.tipo || nombre}`);
    const d = crear(cfg, opciones);
    out[nombre] = { nombre, async registrar(exp, plantilla) { return d.registrar(exp, plantilla, almacen ? await almacen.config() : {}); } };
  }
  return out;
}
