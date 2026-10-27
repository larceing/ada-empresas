// ada-infra: convierte los resultados de las comprobaciones de infra (bases de datos, ejecuciones,
// controles, unidades de red, copias, servidores) en los datos que pinta la oficina (MundoAda.pintar).
// Sin dependencias y sin red: solo transforma datos. Funciona en el navegador (window.AdaInfra) y en Node.
'use strict';
(function (raiz) {
  // Un worker por tipo de comprobación. Se pueden cambiar o añadir con opciones.tipos.
  const TIPOS = {
    bd: { nombre: 'Bases de datos', icono: 'bd', descripcion: 'Mira que cada base de datos responda, su espacio y sus bloqueos.' },
    ejecucion: { nombre: 'Ejecuciones', icono: 'engranaje', descripcion: 'Vigila los jobs y tareas programadas: que corran, a su hora y sin error.' },
    control: { nombre: 'Controles', icono: 'escudo', descripcion: 'Comprobaciones de control: cuadres, duplicados, datos que faltan.' },
    red: { nombre: 'Unidades de red', icono: 'disco', descripcion: 'Que cada unidad de red esté montada, accesible y con espacio.' },
    copia: { nombre: 'Copias', icono: 'copia', descripcion: 'Que las copias de seguridad se hayan hecho y no sean viejas.' },
    servicio: { nombre: 'Servidores', icono: 'servidor', descripcion: 'Servidores y servicios: que respondan, CPU, memoria y disco.' },
  };
  // Estado de cada comprobación (lo que manda tu sistema de tareas) → estado del puesto en la oficina
  const PESO = { error: 4, aviso: 3, corriendo: 2, ok: 1, apagado: 0 };
  const PUESTO = { error: 'error', aviso: 'aviso', corriendo: 'trabaja', ok: 'ok', apagado: 'pausa' };
  const COLOR = { error: '#B3261E', aviso: '#8A5A00', corriendo: '#1D4F7A', ok: '#1E6B4E', apagado: '#8A9099' };
  const TXT = { error: 'Con error', aviso: 'Para mirar', corriendo: 'En marcha', ok: 'Bien', apagado: 'Apagada' };

  // Si una comprobación no ha dado señales en `caducaMin` minutos, pasa a aviso («sin datos»)
  function estadoReal(c, ahora, caducaMin) {
    const e = PESO[c.estado] !== undefined ? c.estado : 'aviso';
    if (e === 'apagado' || !c.cuando || !caducaMin) return { estado: e, detalle: c.detalle || '' };
    const min = (ahora - new Date(c.cuando).getTime()) / 60000;
    if (min > caducaMin && PESO[e] < PESO.aviso) return { estado: 'aviso', detalle: `Sin datos desde hace ${Math.round(min)} min` };
    return { estado: e, detalle: c.detalle || '' };
  }

  // comprobaciones: [{ id, tipo, nombre, estado: 'ok'|'aviso'|'error'|'corriendo'|'apagado', detalle?, cuando? (ISO), caducaMin? }]
  // opciones: { tipos?, ahora? (ms), caducaMin? (por defecto 0 = no caduca), oficina?, oficinas? }
  function aDatos(comprobaciones, opciones = {}) {
    const tipos = { ...TIPOS, ...(opciones.tipos || {}) };
    const ahora = opciones.ahora || Date.now();
    const grupos = {};
    for (const c of comprobaciones || []) {
      const t = tipos[c.tipo] ? c.tipo : 'servicio';
      const r = estadoReal(c, ahora, c.caducaMin ?? opciones.caducaMin ?? 0);
      (grupos[t] = grupos[t] || []).push({ ...c, tipo: t, estado: r.estado, detalle: r.detalle });
    }
    const trabajadores = Object.keys(tipos).filter((t) => grupos[t]).map((t) => {
      const lista = grupos[t].sort((a, b) => PESO[b.estado] - PESO[a.estado] || String(a.nombre).localeCompare(String(b.nombre)));
      const peor = lista[0].estado;
      const problemas = lista.filter((c) => c.estado === 'error' || c.estado === 'aviso');
      const todasApagadas = lista.every((c) => c.estado === 'apagado');
      return {
        id: 'infra-' + t,
        nombre: tipos[t].nombre,
        icono: tipos[t].icono,
        descripcion: tipos[t].descripcion,
        estado: todasApagadas ? 'pausa' : PUESTO[peor],
        cifra: problemas.length,
        frase: problemas.length ? `${problemas[0].nombre}: ${problemas[0].detalle || TXT[problemas[0].estado]}` : lista.some((c) => c.estado === 'corriendo') ? 'Comprobando…' : `${lista.length} en orden`,
        // en la vista de frente salen como «sus herramientas»: lo primero, lo que va peor
        herramientas: lista.slice(0, 4).map((c) => ({ n: c.nombre, d: c.detalle || TXT[c.estado], ic: tipos[t].icono, c: COLOR[c.estado] })),
        comprobaciones: lista,
      };
    });
    const total = trabajadores.reduce((n, w) => n + w.cifra, 0);
    const conError = trabajadores.some((w) => w.estado === 'error');
    return {
      oficina: opciones.oficina || 'infra',
      oficinas: opciones.oficinas || [{ id: opciones.oficina || 'infra', nombre: 'Infra' }],
      ada: {
        estado: conError ? 'error' : total ? 'aviso' : 'ok',
        frase: total ? `Hay ${total} ${total === 1 ? 'cosa' : 'cosas'} que mirar` : 'Todo en calma',
      },
      trabajadores,
      resumen: {
        total: (comprobaciones || []).length,
        error: trabajadores.reduce((n, w) => n + w.comprobaciones.filter((c) => c.estado === 'error').length, 0),
        aviso: trabajadores.reduce((n, w) => n + w.comprobaciones.filter((c) => c.estado === 'aviso').length, 0),
        ok: trabajadores.reduce((n, w) => n + w.comprobaciones.filter((c) => c.estado === 'ok').length, 0),
      },
    };
  }

  raiz.AdaInfra = { aDatos, TIPOS, TXT, COLOR };
})(typeof window !== 'undefined' ? window : globalThis);
