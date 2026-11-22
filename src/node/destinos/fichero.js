// Destino «fichero»: para los ERP sin API abierta (Sage, A3…) se deja un CSV por pedido en una carpeta
// que el ERP importa (o vigila). Separador «;» y coma decimal, que es lo que esperan los programas en España.
import fs from 'node:fs';
import path from 'node:path';
import { FalloDestino, idEn } from './comun.js';

const celda = (v) => { const t = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

export function crearFichero(cfg) {
  const erp = cfg.erp || 'fichero';
  return {
    nombre: `fichero-${erp}`,
    async registrar(exp, _plantilla, config = {}) {
      if (!cfg.carpeta) throw new FalloDestino('Fichero: falta la carpeta en la config');
      const d = exp.datos || {};
      const cliente = idEn(config.clientes, 'id', exp.cliente && exp.cliente.id, erp) ?? (exp.cliente && exp.cliente.id) ?? '';
      const filas = [['cliente', 'pedido_cliente', 'fecha_entrega', 'direccion_entrega', 'producto', 'cantidad', 'precio', 'ref_cliente', 'expediente']];
      for (const l of d.lineas || []) filas.push([cliente, d.numero_pedido, d.fecha_entrega, d.direccion_entrega, idEn(config.catalogo, 'ref', l.producto, erp) ?? l.producto, l.cantidad, l.precio, l.ref, exp.id]);
      const nombre = `pedido-${String(d.numero_pedido || exp.id).replace(/[^\w.-]+/g, '_')}-${exp.id.slice(0, 8)}.csv`;
      try {
        fs.mkdirSync(cfg.carpeta, { recursive: true });
        const f = path.join(cfg.carpeta, nombre);
        fs.writeFileSync(`${f}.tmp`, '﻿' + filas.map((r) => r.map(celda).join(';')).join('\r\n') + '\r\n');
        fs.renameSync(`${f}.tmp`, f); // el ERP no ve el fichero hasta que está entero
      } catch (e) { throw new FalloDestino(`Fichero: no se puede escribir (${e.message})`); }
      return { referencia: nombre };
    },
  };
}
