// Ejemplo de ada-infra con datos inventados. En tu sistema, cambia `comprobaciones` por lo que
// devuelva tu API (p. ej. fetch('/api/infra/comprobaciones')) y llama a refrescar() cada minuto.
'use strict';
(() => {
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
  let comprobaciones = [
    { id: 'bd-erp', tipo: 'bd', nombre: 'SQL ERP (producción)', estado: 'ok', detalle: 'Responde en 40 ms · 62 % de espacio', cuando: hace(1) },
    { id: 'bd-dw', tipo: 'bd', nombre: 'Data warehouse', estado: 'aviso', detalle: 'Espacio al 91 %', cuando: hace(2) },
    { id: 'bd-crm', tipo: 'bd', nombre: 'BD CRM', estado: 'ok', detalle: 'Sin bloqueos', cuando: hace(1) },
    { id: 'job-carga', tipo: 'ejecucion', nombre: 'Carga nocturna ETL', estado: 'error', detalle: 'Falló a las 03:12 (timeout)', cuando: hace(5) },
    { id: 'job-facturas', tipo: 'ejecucion', nombre: 'Envío de facturas', estado: 'corriendo', detalle: 'Paso 2 de 4', cuando: hace(0) },
    { id: 'job-cubo', tipo: 'ejecucion', nombre: 'Proceso del cubo', estado: 'ok', detalle: 'Acabó 06:05 en 12 min', cuando: hace(3) },
    { id: 'ctl-stock', tipo: 'control', nombre: 'Cuadre de stock', estado: 'ok', detalle: 'Cuadra', cuando: hace(10) },
    { id: 'ctl-dup', tipo: 'control', nombre: 'Pedidos duplicados', estado: 'aviso', detalle: '3 posibles duplicados', cuando: hace(10) },
    { id: 'red-s', tipo: 'red', nombre: 'Unidad S: (compartida)', estado: 'ok', detalle: 'Montada · 48 % libre', cuando: hace(1) },
    { id: 'red-p', tipo: 'red', nombre: 'Unidad P: (proyectos)', estado: 'ok', detalle: 'Montada · 22 % libre', cuando: hace(1) },
    { id: 'cop-bd', tipo: 'copia', nombre: 'Copia de bases de datos', estado: 'ok', detalle: 'Hecha hoy 02:00', cuando: hace(1) },
    { id: 'cop-fich', tipo: 'copia', nombre: 'Copia de ficheros', estado: 'ok', detalle: 'Hecha hoy 01:30', cuando: hace(1) },
    { id: 'srv-app', tipo: 'servicio', nombre: 'Servidor de aplicaciones', estado: 'ok', detalle: 'CPU 23 % · RAM 61 %', cuando: hace(1) },
    { id: 'srv-informes', tipo: 'servicio', nombre: 'Servidor de informes', estado: 'ok', detalle: 'Responde', cuando: hace(1) },
  ];
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, texto) { const e = document.createElement(tag); if (cls) e.className = cls; if (texto !== undefined) e.textContent = texto; return e; }
  let elegido = null, datos = null;

  function refrescar() {
    datos = window.AdaInfra.aDatos(comprobaciones, { caducaMin: 30 });
    window.MundoAda.pintar(datos, elegido);
    const r = datos.resumen;
    $('kpis').replaceChildren(...[['error', r.error, 'con error'], ['aviso', r.aviso, 'para mirar'], ['ok', r.ok, 'bien'], ['', r.total, 'comprobaciones']].map(([c, n, t]) => {
      const k = el('div', 'kpi ' + c); k.append(el('b', '', String(n)), el('small', '', t)); return k;
    }));
    lateral();
  }

  function fila(c) {
    const f = el('div', 'fila');
    f.append(el('span', 'etiqueta ' + c.estado, window.AdaInfra.TXT[c.estado]), el('b', '', c.nombre), el('small', '', c.detalle || ''));
    return f;
  }
  function lateral() {
    const l = $('lateral');
    const w = elegido && datos.trabajadores.find((x) => x.id === elegido);
    if (w) {
      const cerrar = el('button', 'cerrar', '×'); cerrar.type = 'button'; cerrar.setAttribute('aria-label', 'Cerrar');
      cerrar.addEventListener('click', () => elegir(null));
      l.replaceChildren(cerrar, el('h2', '', w.nombre), el('p', '', w.descripcion), ...w.comprobaciones.map(fila));
      return;
    }
    const problemas = datos.trabajadores.flatMap((x) => x.comprobaciones).filter((c) => c.estado === 'error' || c.estado === 'aviso');
    l.replaceChildren(el('h2', '', 'Lo que hay que mirar'), el('p', '', problemas.length ? 'Pulsa un puesto para ver todas sus comprobaciones.' : 'Todo en calma.'), ...problemas.map(fila));
  }
  function elegir(id) { elegido = id === 'ada' ? null : (id === elegido ? null : id); refrescar(); }

  // Simulación: cada 5 s cambia una comprobación al azar (solo en este ejemplo)
  const ESTADOS = ['ok', 'ok', 'ok', 'aviso', 'error', 'corriendo'];
  setInterval(() => {
    if (!$('simular').checked) return;
    const i = Math.floor(Math.random() * comprobaciones.length);
    const estado = ESTADOS[Math.floor(Math.random() * ESTADOS.length)];
    const detalle = { ok: 'Vuelve a estar bien', aviso: 'Algo raro: revisar', error: 'Ha fallado ahora mismo', corriendo: 'Comprobando…' }[estado];
    comprobaciones = comprobaciones.map((c, k) => (k === i ? { ...c, estado, detalle, cuando: new Date().toISOString() } : c));
    refrescar();
  }, 5000);

  window.MundoAda.montar($('mundo'), { alElegir: elegir });
  refrescar();
})();
