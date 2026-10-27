// La oficina de Ada en vista isométrica: Ada en su sala del centro, un puesto por worker alrededor
// de un pasillo, y paquetes de trabajo que salen de Ada y viajan hasta cada puesto. Al elegir uno, su puesto de frente.
// Solo SVG y JS propios: nada de librerías ni de servicios externos. Se usa en el panel y en el Laboratorio.
// Copia de larceing/ada (public/mundo.js) para la familia Ada; aquí se añaden los iconos de infra. Ver visual/LEEME.md.
'use strict';
(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Proyección: una casilla del suelo mide 2W × 2H en pantalla y una unidad de altura, Z.
  const W = 32, H = 16, Z = 34;
  const P = (x, y, z = 0) => [(x - y) * W, (x + y) * H - z * Z];
  const pts = (...l) => l.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
  const VB = { x: -415, y: -95, w: 830, h: 515 };

  // Colores planos de la plantilla (sin degradados ni transparencias de cristal)
  const C = {
    suelo: '#EEF2F7', sueloLado: '#C9D7E6', sueloFrente: '#B4C6DA', junta: '#E1E8F0',
    pasillo: '#DCE5EF', guia: '#9DB8D4',
    muroIzq: '#E6EBF2', muroDer: '#D3DEEA', muroTecho: '#FFFFFF', cielo: '#D3E4F5',
    alfombra: '#E3ECF6', tabique: { izq: '#FFFFFF', der: '#E6EBF2', techo: '#C9D7E6' },
    mesa: { izq: '#C9B79C', der: '#B5A285', techo: '#E2D4BD' },
    pantalla: { izq: '#2E3238', der: '#191C20', techo: '#3A3F46' },
    silla: { izq: '#5A5F67', der: '#464B52', techo: '#6C727A' },
    azul: '#1D4F7A', azulClaro: '#D3E4F5', verde: '#1E6B4E', ambar: '#8A5A00', rojo: '#B3261E', gris: '#8A9099',
  };
  const CAMISAS = { guionista: '#1D4F7A', ilustrador: '#7A4F9A', voz: '#1E6B4E', montador: '#8A5A00', revisor: '#5A8BB5', publicador: '#B3261E', linkedin: '#0A66C2', vigilante: '#2E3238', contable: '#4F7A3A' };
  const PIEL = { guionista: '#E9C4A6', ilustrador: '#C99A78', voz: '#F0D2BA', montador: '#B07E5C', revisor: '#E9C4A6', publicador: '#D9AE8C', linkedin: '#F0D2BA', vigilante: '#C99A78', contable: '#E9C4A6' };
  // Colores para los workers que se añadan desde el panel (fijos por id)
  const hash = (t) => [...String(t)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const tono = (mapa, id, lista) => mapa[id] || lista[hash(id + lista.length) % lista.length];
  const camisa = (id) => tono(CAMISAS, id, ['#1D4F7A', '#7A4F9A', '#1E6B4E', '#8A5A00', '#5A8BB5', '#B3261E', '#0A66C2', '#4F7A3A']);
  const piel = (id) => tono(PIEL, id, ['#E9C4A6', '#C99A78', '#F0D2BA', '#B07E5C', '#D9AE8C']);
  const pelo = (id) => tono(PELO, id, ['#3A2A1E', '#1E1E1E', '#8A5A2B', '#5B3A22', '#C9A25A', '#6B6B6B']);
  const PELO = { guionista: '#3A2A1E', ilustrador: '#1E1E1E', voz: '#8A5A2B', montador: '#1E1E1E', revisor: '#5B3A22', publicador: '#2B2B2B', linkedin: '#C9A25A', vigilante: '#1E1E1E', contable: '#6B6B6B' };

  // Plano de la oficina (casillas). El pasillo es un anillo de 2.6 a 9.4; Ada ocupa el centro.
  const R0 = 2.6, R1 = 9.4, LADO = R1 - R0, S = 1.8;
  const SITIOS = {
    guionista: { x: 1.1, y: 1.1, anillo: 0 },
    ilustrador: { x: 6, y: 1.1, anillo: 0.5 },
    voz: { x: 10.9, y: 1.1, anillo: 1 },
    montador: { x: 10.9, y: 6, anillo: 1.5 },
    revisor: { x: 10.9, y: 10.9, anillo: 2 },
    publicador: { x: 6, y: 10.9, anillo: 2.5 },
    linkedin: { x: 1.1, y: 10.9, anillo: 3 },
    vigilante: { x: 1.1, y: 6, anillo: 3.5 },
    contable: { x: 3.95, y: 8.05, anillo: 3 + (R1 - 8.05) / LADO, s: 1.2 },
  };
  const ADA = { x: 6, y: 6, s: 2.4 };
  const SALIDAS = [
    { anillo: 0.5, desde: [6, ADA.y - ADA.s / 2] },
    { anillo: 1.5, desde: [ADA.x + ADA.s / 2, 6] },
    { anillo: 2.5, desde: [6, ADA.y + ADA.s / 2] },
    { anillo: 3.5, desde: [ADA.x - ADA.s / 2, 6] },
  ];

  // Anexos de la planta: el café a la derecha (allí van los que trabajan en el PC cuando está apagado)
  // y la puerta a la oficina de al lado a la izquierda (los paquetes salen y entran por ella)
  const CAFE = { x0: 12, x1: 14.6, y0: 2.4, y1: 5.8, y: 4.1 };
  const SITIOS_CAFE = [[12.7, 3.75], [13.25, 3.45], [12.95, 4.55], [13.75, 4.6], [14.15, 5.15], [13.3, 5.3]];
  const PUERTA = { x: 4.1, y: 13.35, anillo: 2 + (R1 - 4.1) / LADO };
  const ANILLO_CAFE = 1 + (CAFE.y - R0) / LADO;
  // La trituradora (papelera), junto a la sala de Ada: lo descartado entra por arriba y se puede recuperar 30 días
  const TRITURA = { x: 7.85, y: 7.05 };

  // Huecos para los workers que se añadan: tres rincones dentro del pasillo y ocho más por fuera (20 puestos en total)
  const HUECOS = [
    { x: 8.05, y: 3.95, anillo: 1 + (3.95 - R0) / LADO, s: 1.2 },
    { x: 8.05, y: 8.05, anillo: 1 + (8.05 - R0) / LADO, s: 1.2 },
    { x: 3.95, y: 3.95, anillo: 3 + (R1 - 3.95) / LADO, s: 1.2 },
    ...[0.25, 1.25, 2.25, 3.25, 0.75, 1.75, 2.75, 3.75].map((a) => {
      const [rx, ry] = enAnillo(a), d = R0 - 1.1, o = [[0, -d], [d, 0], [0, d], [-d, 0]][Math.floor(a)];
      return { x: rx + o[0], y: ry + o[1], anillo: a, s: 1.3 };
    }),
  ];
  const asignados = {};
  // Orden en que se llenan los sitios en una oficina nueva: esquinas, mitades y luego los huecos
  const ORDEN_SERIE = ['guionista', 'voz', 'revisor', 'linkedin', 'ilustrador', 'montador', 'publicador', 'vigilante', 'contable'];
  function sitioDe(id) {
    if (id === 'ada') return ADA;
    if (id === 'puerta') return PUERTA;
    if (SITIOS[id]) return SITIOS[id];
    return asignados[id] || null;
  }
  // Da sitio a los workers nuevos: primero los puestos de serie que estén libres en esta oficina y luego los huecos
  function repartir(ids) {
    const usados = new Set(Object.values(asignados));
    for (const id of ids) if (SITIOS[id]) usados.add(SITIOS[id]);
    const libres = [...ORDEN_SERIE.filter((k) => !ids.includes(k)).map((k) => SITIOS[k]), ...HUECOS].filter((x) => !usados.has(x));
    for (const id of ids) if (!SITIOS[id] && !asignados[id] && libres.length) asignados[id] = libres.shift();
  }

  // Punto del anillo para s en [0,4): 0 arriba, 1 derecha, 2 abajo, 3 izquierda (en pantalla, sentido horario)
  function enAnillo(s) {
    s = ((s % 4) + 4) % 4;
    const k = Math.floor(s), f = s - k;
    if (k === 0) return [R0 + f * LADO, R0];
    if (k === 1) return [R1, R0 + f * LADO];
    if (k === 2) return [R1 - f * LADO, R1];
    return [R0, R1 - f * LADO];
  }

  function nodo(tag, attrs = {}, ...hijos) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      // La CSP no deja atributos style: las variables van por CSSOM
      if (k === 'style') for (const par of String(v).split(';')) { const [a, b] = par.split(':'); if (a && b !== undefined) e.style.setProperty(a.trim(), b.trim()); }
      else e.setAttribute(k, v);
    }
    for (const h of hijos.flat()) if (h) e.append(h);
    return e;
  }
  const poli = (puntos, fill, extra = {}) => nodo('polygon', { points: pts(...puntos), fill, ...extra });

  // Caja isométrica: base (x0,y0)-(x1,y1), de z0 a z1, con sus tres caras visibles.
  function caja(x0, y0, x1, y1, z0, z1, col, clase) {
    return nodo('g', { class: clase },
      poli([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], col.izq),
      poli([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], col.der),
      poli([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], col.techo));
  }
  // Matrices que llevan un dibujo plano (u a la derecha, v hacia abajo, en casillas) a la cara izquierda (y fija) o derecha (x fija)
  const caraIzq = (x0, y, ztop) => { const o = P(x0, y, ztop); return `matrix(${W} ${H} 0 ${Z} ${o[0]} ${o[1]})`; };
  const caraDer = (x, y0, ztop) => { const o = P(x, y0, ztop); return `matrix(${-W} ${H} 0 ${Z} ${o[0]} ${o[1]})`; };

  // ---------- iconos (trazos de 24×24), compartidos con el panel ----------
  const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const ICONOS = {
    puerta: ['M6 21V3h10v18', 'M3 21h18', 'M13 12h.5', 'M16 8l4 4-4 4'],
    pluma: ['M4 20l4-1 11-11-3-3L5 16l-1 4z', 'M14 6l3 3'],
    imagen: ['M3 5h18v14H3z', circ(9, 10, 2), 'M3 17l5-5 4 4 3-3 6 6'],
    micro: ['M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
    pelicula: ['M3 5h18v14H3z', 'M7 5v14', 'M17 5v14', 'M3 9h4', 'M3 15h4', 'M17 9h4', 'M17 15h4'],
    lupa: [circ(11, 11, 6), 'M20 20l-4.5-4.5', 'M8.5 11l2 2 3.5-3.5'],
    enviar: ['M3 11l18-8-8 18-2-8-8-2z', 'M11 13l10-10'],
    in: ['M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z', 'M8 10v7', 'M8 7v.01', 'M12 17v-4a2 2 0 0 1 4 0v4', 'M12 10v7'],
    ojo: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', circ(12, 12, 3)],
    reloj: [circ(12, 12, 9), 'M12 7v5l3 2'],
    hecho: [circ(12, 12, 9), 'M8 12.5l2.5 2.5L16 9.5'],
    alerta: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17.5v.01'],
    moneda: [circ(12, 12, 9), 'M15 9h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9', 'M12 6v2', 'M12 16v2'],
    chat: ['M4 5h16v11H9l-5 4z', 'M8 9h8', 'M8 12h5'],
    chispa: ['M12 3c.8 4.5 4.5 8.2 9 9-4.5.8-8.2 4.5-9 9-.8-4.5-4.5-8.2-9-9 4.5-.8 8.2-4.5 9-9z'],
    nodos: [circ(5, 12, 2.5), circ(19, 6, 2.5), circ(19, 18, 2.5), 'M7.5 11l9-4', 'M7.5 13l9 4'],
    tabla: ['M3 5h18v14H3z', 'M3 10h18', 'M3 15h18', 'M9 5v14'],
    nube: ['M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z'],
    navegador: ['M3 5h18v14H3z', 'M3 9h18', 'M6 7h.01', 'M9 7h.01'],
    codigo: ['M8 8l-4 4 4 4', 'M16 8l4 4-4 4', 'M13.5 6l-3 12'],
    play: ['M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z', 'M10 9l5 3-5 3z'],
    capas: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
    correo: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
    latido: ['M3 12h4l2-5 4 10 2-5h6'],
    // redes (trazos sencillos que se reconocen de un vistazo) y la trituradora
    instagram: ['M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z', circ(12, 12, 4), 'M17.5 6.5v.01'],
    tiktok: ['M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5', 'M14 3c.5 2.8 2.4 4.6 5 5'],
    youtube: ['M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z', 'M10 9l5 3-5 3z'],
    facebook: ['M14 21v-8h3l.5-3H14V8a1.5 1.5 0 0 1 1.5-1.5H18V3.5h-3A4 4 0 0 0 11 7.5V10H8v3h3v8'],
    // infra (ada-infra)
    bd: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
    servidor: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01', 'M12 7h4', 'M12 17h4'],
    disco: ['M3 14h18v5H3z', 'M5 14l2-9h10l2 9', 'M7 16.5h.01', 'M12 5v-2', 'M9 3h6'],
    engranaje: [circ(12, 12, 3), 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M4.9 4.9l2.1 2.1', 'M17 17l2.1 2.1', 'M4.9 19.1L7 17', 'M17 7l2.1-2.1'],
    escudo: ['M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z', 'M8.5 12l2.5 2.5 4.5-4.5'],
    copia: ['M8 8h12v12H8z', 'M4 16V4h12', 'M11 14l2 2 4-4'],
    tritura: ['M5 4h14v6H5z', 'M3 10h18', 'M7 13v8', 'M10 13v6', 'M13 13v8', 'M16 13v5', 'M8 7h8'],
  };
  function icono(n) {
    const s = nodo('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    for (const d of ICONOS[n] || []) s.append(nodo('path', { d }));
    return s;
  }

  // ---------- la oficina ----------
  function suelo() {
    let g = nodo('g', { class: 'suelo' });
    const e = 0.45;
    g.append(poli([P(0, 12, 0), P(12, 12, 0), P(12, 12, -e), P(0, 12, -e)], C.sueloLado));
    g.append(poli([P(12, 0, 0), P(12, 12, 0), P(12, 12, -e), P(12, 0, -e)], C.sueloFrente));
    g.append(poli([P(0, 0), P(12, 0), P(12, 12), P(0, 12)], C.suelo));
    for (let i = 1; i < 12; i++) {
      const a = P(i, 0), b = P(i, 12), c = P(0, i), d = P(12, i);
      g.append(nodo('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.junta, 'stroke-width': 0.8 }));
      g.append(nodo('line', { x1: c[0], y1: c[1], x2: d[0], y2: d[1], stroke: C.junta, 'stroke-width': 0.8 }));
    }
    // pasillo en anillo y ramales hasta la sala de Ada
    const a = 0.45, ext = [P(R0 - a, R0 - a), P(R1 + a, R0 - a), P(R1 + a, R1 + a), P(R0 - a, R1 + a)], int = [P(R0 + a, R0 + a), P(R1 - a, R0 + a), P(R1 - a, R1 - a), P(R0 + a, R1 - a)];
    const camino = (l) => 'M' + l.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L') + 'Z';
    g.append(nodo('path', { d: camino(ext) + camino(int.reverse()), fill: C.pasillo, 'fill-rule': 'evenodd' }));
    for (const sl of SALIDAS) {
      const [rx, ry] = enAnillo(sl.anillo), [dx, dy] = sl.desde, an = 0.3, hor = Math.abs(ry - dy) < 0.01;
      const q = hor ? [P(Math.min(dx, rx), ry - an), P(Math.max(dx, rx), ry - an), P(Math.max(dx, rx), ry + an), P(Math.min(dx, rx), ry + an)]
        : [P(rx - an, Math.min(dy, ry)), P(rx + an, Math.min(dy, ry)), P(rx + an, Math.max(dy, ry)), P(rx - an, Math.max(dy, ry))];
      g.append(poli(q, C.pasillo));
    }
    // anexos: café y pasillo hasta la puerta, con su ramal desde el anillo
    const anexo = (x0, y0, x1, y1, tapa) => {
      g.append(poli([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, -e), P(x0, y1, -e)], C.sueloLado));
      g.append(poli([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, -e), P(x1, y0, -e)], C.sueloFrente));
      g.append(poli([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], tapa));
    };
    anexo(CAFE.x0, CAFE.y0, CAFE.x1, CAFE.y1, '#F3EDE4');
    for (let i = 1; i < 6; i++) { const a = P(CAFE.x0, CAFE.y0 + i * 0.57), b = P(CAFE.x1, CAFE.y0 + i * 0.57); g.append(nodo('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#E6DDCF', 'stroke-width': 0.8 })); }
    g.append(poli([P(R1, CAFE.y - 0.3), P(CAFE.x0, CAFE.y - 0.3), P(CAFE.x0, CAFE.y + 0.3), P(R1, CAFE.y + 0.3)], C.pasillo));
    const pz = nodo('g', { class: 'anexo-puerta' });
    g.append(pz);
    pz.append(poli([P(PUERTA.x - 0.3, R1), P(PUERTA.x + 0.3, R1), P(PUERTA.x + 0.3, 12), P(PUERTA.x - 0.3, 12)], C.pasillo));
    const gq = g; // el pasillo de la puerta solo se ve si hay otra oficina
    g = pz; anexo(PUERTA.x - 0.55, 12, PUERTA.x + 0.55, PUERTA.y + 0.25, C.pasillo); g = gq;
    // guías del suelo que corren en el sentido del trabajo
    g.append(nodo('path', { class: 'guia', d: camino([P(R0, R0), P(R1, R0), P(R1, R1), P(R0, R1)]), fill: 'none', stroke: C.guia, 'stroke-width': 1.4, 'stroke-dasharray': '6 10' }));
    return g;
  }

  // Muros del fondo con ventanales (la oficina se ve «cortada» por delante)
  function muros() {
    const g = nodo('g', { class: 'muros' }), h = 2.1, t = 0.14;
    g.append(caja(0, 0, t, 12, 0, h, { izq: C.muroIzq, der: C.muroDer, techo: C.muroTecho }));
    g.append(caja(0, 0, 12, t, 0, h, { izq: C.muroIzq, der: C.muroDer, techo: C.muroTecho }));
    const ventanal = (tr, n) => nodo('g', { transform: tr }, ...Array.from({ length: n }, (_, i) => nodo('rect', { x: 0.6 + i * 1.45, y: 0.35, width: 1.05, height: 1.05, fill: C.cielo })));
    g.append(ventanal(caraIzq(0, t, h), 8));
    g.append(ventanal(caraDer(t, 0, h), 8));
    return g;
  }

  function puesto(id, s, i) {
    const lado = s.s || S, m = lado / 2, x0 = s.x - m, y0 = s.y - m, x1 = s.x + m, y1 = s.y + m;
    const g = nodo('g', { class: 'puesto', 'data-id': id, style: `--i:${i}` });
    g.append(nodo('ellipse', { class: 'aura', cx: P(s.x, s.y)[0], cy: P(s.x, s.y)[1], rx: (lado + 0.7) * W * 1.05, ry: (lado + 0.7) * H * 1.05, fill: 'none', 'stroke-width': 2.5 }));
    const c = nodo('g', { class: 'cuerpo' });
    c.append(poli([P(x0, y0, 0.01), P(x1, y0, 0.01), P(x1, y1, 0.01), P(x0, y1, 0.01)], C.alfombra, { class: 'alfombra' }));
    // tabiques bajos en los dos lados del fondo
    c.append(caja(x0, y0, x0 + 0.07, y1, 0, 0.8, C.tabique));
    c.append(caja(x0, y0, x1, y0 + 0.07, 0, 0.8, C.tabique));
    // mesa contra el fondo
    const mz = 0.5, my0 = y0 + 0.12, my1 = y0 + 0.62, mx0 = x0 + 0.12, mx1 = x1 - 0.12;
    c.append(caja(mx0, my0, mx1, my1, 0, mz, C.mesa));
    // pantalla con lo que está haciendo
    const px = s.x - 0.05, pw = Math.min(0.75, lado * 0.42);
    c.append(caja(px - 0.04, my0 + 0.1, px + 0.04, my0 + 0.16, mz, mz + 0.18, C.pantalla));
    c.append(caja(px - pw / 2, my0 + 0.08, px + pw / 2, my0 + 0.13, mz + 0.18, mz + 0.62, C.pantalla));
    c.append(nodo('g', { class: 'monitor', transform: caraIzq(px - pw / 2 + 0.04, my0 + 0.13, mz + 0.58) },
      nodo('rect', { class: 'fondo-pantalla', x: 0, y: 0, width: pw - 0.08, height: 0.36 }),
      ...[0, 1, 2].map((k) => nodo('rect', { class: 'renglon', style: `--k:${k}`, x: 0.06, y: 0.07 + k * 0.1, width: (pw - 0.2) * (k === 2 ? 0.55 : 1), height: 0.045 })),
      nodo('text', { class: 'aviso-pantalla', x: (pw - 0.08) / 2, y: 0.29, 'font-size': 0.3, 'text-anchor': 'middle', 'font-weight': 700 }, document.createTextNode('!'))));
    // lo que tiene en la mesa
    c.append(adorno(id, mx0 + 0.32, my0 + 0.28, mz, x1, y0));
    // silla y persona
    const qx = s.x + 0.1, qy = my1 + 0.42;
    c.append(caja(qx - 0.18, qy - 0.16, qx + 0.18, qy + 0.18, 0.18, 0.3, C.silla));
    const persona = nodo('g', { class: 'persona' });
    persona.append(caja(qx - 0.13, qy - 0.1, qx + 0.13, qy + 0.08, 0.3, 0.72, { izq: camisa(id), der: camisa(id), techo: camisa(id) }, 'torso'));
    persona.append(nodo('g', { class: 'sombra-torso' }, poli([P(qx + 0.13, qy - 0.1, 0.3), P(qx + 0.13, qy + 0.08, 0.3), P(qx + 0.13, qy + 0.08, 0.72), P(qx + 0.13, qy - 0.1, 0.72)], '#000000', { 'fill-opacity': 0.18 })));
    const cab = P(qx, qy - 0.01, 0.9);
    persona.append(nodo('g', { class: 'cabeza' },
      nodo('circle', { cx: cab[0], cy: cab[1], r: 6.5, fill: piel(id) }),
      nodo('path', { d: `M${cab[0] - 6.6} ${cab[1] + 0.5}a6.6 6.6 0 0 1 13.2 0c-2-2.6-11.2-2.6-13.2 0z`, fill: pelo(id) })));
    c.append(persona);
    c.append(caja(qx - 0.18, qy + 0.12, qx + 0.18, qy + 0.18, 0.3, 0.55, C.silla));
    // humo si hay error y «z z» si duerme
    for (let k = 0; k < 3; k++) { const p = P(px, my0 + 0.1, mz + 0.7); c.append(nodo('circle', { class: 'humo', style: `--i:${k}`, cx: p[0], cy: p[1], r: 4.5, fill: '#9AA3AD' })); }
    const zz = P(qx, qy, 1.1); c.append(nodo('text', { class: 'zz', x: zz[0] + 8, y: zz[1], 'font-size': 12, 'font-weight': 700, fill: C.gris }, document.createTextNode('z z')));
    g.append(c);
    return g;
  }

  // Lo que hay en la mesa de cada uno; x,y,z: esquina de la mesa
  function adorno(id, x, y, z, x1, y0) {
    const [X, Y] = P(x, y, z);
    const g = nodo('g', { class: 'adorno a-' + id });
    switch (id) {
      case 'guionista':
        for (let i = 0; i < 3; i++) g.append(nodo('g', { transform: `translate(${X} ${Y - 3})` }, nodo('g', { class: 'hoja', style: `--i:${i}` },
          poli([[-5, 0], [3, -4], [7, 1], [-1, 5]], '#FFFFFF', { stroke: C.azul, 'stroke-width': 0.7 }))));
        g.append(caja(x - 0.12, y - 0.08, x + 0.12, y + 0.1, z, z + 0.08, { izq: '#FFFFFF', der: '#E6EBF2', techo: '#FFFFFF' }));
        break;
      case 'ilustrador': {
        g.append(nodo('g', { transform: caraIzq(x - 0.2, y + 0.05, z + 0.55) },
          nodo('rect', { x: 0, y: 0, width: 0.5, height: 0.42, fill: '#FFFFFF', stroke: C.azul, 'stroke-width': 0.03 }),
          ...[C.azul, '#5A8BB5', C.verde, C.ambar].map((col, i) => nodo('rect', { class: 'pincelada', style: `--i:${i}`, x: 0.05 + (i % 2) * 0.22, y: 0.05 + Math.floor(i / 2) * 0.17, width: 0.18, height: 0.14, fill: col }))));
        break;
      }
      case 'voz': {
        const b = P(x, y, z), a = P(x, y, z + 0.35);
        g.append(nodo('line', { x1: b[0], y1: b[1], x2: a[0], y2: a[1], stroke: '#2E3238', 'stroke-width': 1.6 }));
        g.append(nodo('rect', { x: a[0] - 3, y: a[1] - 7, width: 6, height: 9, rx: 3, fill: '#2E3238' }));
        for (let i = 0; i < 3; i++) g.append(nodo('ellipse', { class: 'onda-voz', style: `--i:${i}`, cx: a[0], cy: a[1] - 3, rx: 8, ry: 5, fill: 'none', stroke: C.verde, 'stroke-width': 1.2 }));
        break;
      }
      case 'montador':
        g.append(nodo('g', { transform: caraIzq(x - 0.2, y + 0.05, z + 0.5) }, nodo('g', { class: 'bobina' },
          nodo('circle', { cx: 0.22, cy: 0.22, r: 0.21, fill: '#FFFFFF', stroke: C.ambar, 'stroke-width': 0.035 }),
          ...[0, 1, 2, 3, 4].map((i) => nodo('circle', { cx: (0.22 + Math.cos(i * 1.2566) * 0.12).toFixed(3), cy: (0.22 + Math.sin(i * 1.2566) * 0.12).toFixed(3), r: 0.045, fill: C.ambar })))));
        break;
      case 'revisor':
        g.append(nodo('g', { class: 'lupa', transform: `translate(${X} ${Y - 8})` },
          nodo('circle', { cx: 0, cy: 0, r: 5.5, fill: '#FFFFFF', stroke: C.azul, 'stroke-width': 1.8 }),
          nodo('line', { x1: 4, y1: 4, x2: 8.5, y2: 8.5, stroke: C.azul, 'stroke-width': 2.2, 'stroke-linecap': 'round' })));
        break;
      case 'publicador':
        for (let i = 0; i < 2; i++) g.append(nodo('g', { transform: `translate(${X} ${Y - 6})` },
          nodo('g', { class: 'avion', style: `--i:${i}` }, poli([[-6, 2], [7, -3], [-1, 4]], '#FFFFFF', { stroke: C.azul, 'stroke-width': 0.9 }), poli([[-1, 4], [7, -3], [0, 1]], C.azulClaro))));
        break;
      case 'linkedin':
        g.append(nodo('g', { transform: caraIzq(x - 0.18, y + 0.05, z + 0.38) },
          nodo('rect', { x: 0, y: 0, width: 0.36, height: 0.34, rx: 0.04, fill: '#0A66C2' }),
          nodo('rect', { x: 0.07, y: 0.14, width: 0.05, height: 0.14, fill: '#FFFFFF' }), nodo('rect', { x: 0.07, y: 0.06, width: 0.05, height: 0.05, fill: '#FFFFFF' }),
          nodo('rect', { x: 0.16, y: 0.14, width: 0.05, height: 0.14, fill: '#FFFFFF' }), nodo('path', { d: 'M0.21 0.17q0.03-0.04 0.07-0.03q0.03 0.01 0.03 0.06v0.08h-0.05v-0.07q0-0.03-0.03-0.03t-0.02 0.03z', fill: '#FFFFFF' })));
        break;
      case 'vigilante': {
        // sirena en la esquina del tabique; su luz barre el suelo
        const luz = P(x1 - 0.15, y0 + 0.15, 0.95);
        g.append(caja(x1 - 0.25, y0 + 0.05, x1 - 0.05, y0 + 0.25, 0.8, 0.88, { izq: '#5A5F67', der: '#464B52', techo: '#6C727A' }));
        g.append(nodo('polygon', { class: 'haz', points: '', fill: C.ambar, 'fill-opacity': 0.16 }));
        g.append(nodo('circle', { class: 'foco', cx: luz[0], cy: luz[1], r: 4, fill: C.ambar }));
        g.dataset.luz = luz.join(',');
        // segunda pantalla con cámaras
        g.append(nodo('g', { transform: caraIzq(x - 0.25, y + 0.02, z + 0.5) }, ...[0, 1, 2, 3].map((k) => nodo('rect', { class: 'camara', style: `--i:${k}`, x: (k % 2) * 0.25, y: Math.floor(k / 2) * 0.2, width: 0.23, height: 0.18, fill: '#2E3238' }))));
        break;
      }
      default: // workers añadidos desde el panel: una libreta y una planta
        g.append(caja(x - 0.14, y - 0.06, x + 0.14, y + 0.14, z, z + 0.05, { izq: '#FFFFFF', der: '#E6EBF2', techo: '#D3E4F5' }));
        g.append(caja(x1 - 0.42, y0 + 0.2, x1 - 0.26, y0 + 0.36, z, z + 0.14, { izq: '#B5A285', der: '#9C8A6E', techo: '#5A3A22' }));
        g.append(nodo('circle', { class: 'planta', cx: P(x1 - 0.34, y0 + 0.28, z + 0.3)[0], cy: P(x1 - 0.34, y0 + 0.28, z + 0.3)[1], r: 6, fill: C.verde }));
        break;
      case 'contable':
        for (let i = 0; i < 3; i++) {
          const p = P(x + i * 0.12, y + 0.05, z);
          g.append(nodo('g', { class: 'moneda', style: `--i:${i}`, transform: `translate(${p[0]} ${p[1] - 2})` },
            nodo('ellipse', { cx: 0, cy: 0, rx: 4.5, ry: 2.3, fill: C.ambar }), nodo('ellipse', { cx: 0, cy: -1.4, rx: 4.5, ry: 2.3, fill: '#E8B84A' })));
        }
        break;
    }
    return g;
  }

  // ---------- el café ----------
  function barraCafe() {
    const g = nodo('g', { class: 'cafe-barra' });
    const y0 = CAFE.y0 + 0.08, y1 = CAFE.y0 + 0.5;
    g.append(caja(CAFE.x0 + 0.5, y0, CAFE.x1 - 0.15, y1, 0, 0.55, { izq: '#8A5A2B', der: '#6E4722', techo: '#E2D4BD' }));
    // cafetera con su luz y el vapor
    const mx = CAFE.x1 - 0.75;
    g.append(caja(mx - 0.22, y0 + 0.05, mx + 0.22, y1 - 0.05, 0.55, 1.05, { izq: '#3A3F46', der: '#2E3238', techo: '#5A5F67' }));
    g.append(nodo('g', { transform: caraIzq(mx - 0.2, y1 - 0.05, 1.0) },
      nodo('rect', { x: 0.06, y: 0.06, width: 0.28, height: 0.12, fill: '#191C20' }),
      nodo('circle', { class: 'luz-cafetera', cx: 0.3, cy: 0.3, r: 0.035 })));
    for (let k = 0; k < 3; k++) { const v = P(mx, y1 - 0.15, 1.1); g.append(nodo('circle', { class: 'vapor', style: `--i:${k}`, cx: v[0], cy: v[1], r: 3.5, fill: '#FFFFFF' })); }
    // tazas en la barra y el cartel «Café»
    for (let k = 0; k < 3; k++) { const t = P(CAFE.x0 + 0.8 + k * 0.28, (y0 + y1) / 2, 0.55); g.append(nodo('rect', { x: t[0] - 2.5, y: t[1] - 5, width: 5, height: 5, rx: 1, fill: '#FFFFFF', stroke: '#B5A285', 'stroke-width': 0.6 })); }
    g.append(nodo('g', { transform: caraIzq(CAFE.x0 + 0.7, y0, 1.45) },
      nodo('rect', { x: 0, y: 0, width: 0.95, height: 0.34, rx: 0.06, fill: '#5A3A22' }),
      nodo('text', { x: 0.475, y: 0.25, 'font-size': 0.22, 'font-weight': 700, 'text-anchor': 'middle', fill: '#F6D58A' }, document.createTextNode('Café'))));
    return g;
  }
  function mesaCafe(x, y) {
    const g = nodo('g', { class: 'cafe-mesa' });
    const pie = P(x, y, 0), arriba = P(x, y, 0.5);
    g.append(nodo('line', { x1: pie[0], y1: pie[1], x2: arriba[0], y2: arriba[1], stroke: '#5A5F67', 'stroke-width': 2.5 }));
    g.append(nodo('ellipse', { cx: pie[0], cy: pie[1], rx: 7, ry: 3.5, fill: '#5A5F67' }));
    g.append(nodo('ellipse', { cx: arriba[0], cy: arriba[1] + 1.5, rx: 14, ry: 7, fill: '#B5A285' }));
    g.append(nodo('ellipse', { cx: arriba[0], cy: arriba[1], rx: 14, ry: 7, fill: '#E2D4BD' }));
    return g;
  }
  // Un worker de pie, dibujado en el origen (se mueve con translate). Con taza si está en el café.
  function figura(id) {
    const g = nodo('g', { class: 'figura', 'data-quien': id });
    const gris = { izq: '#3A3F46', der: '#2E3238', techo: '#464B52' };
    g.append(nodo('ellipse', { cx: 0, cy: 0, rx: 8, ry: 4, fill: '#000000', 'fill-opacity': 0.12 }));
    g.append(caja(-0.1, -0.05, -0.01, 0.06, 0, 0.34, gris, 'pierna p1'));
    g.append(caja(0.01, -0.05, 0.1, 0.06, 0, 0.34, gris, 'pierna p2'));
    g.append(caja(-0.13, -0.09, 0.13, 0.08, 0.34, 0.78, { izq: camisa(id), der: camisa(id), techo: camisa(id) }, 'torso'));
    g.append(poli([P(0.13, -0.09, 0.34), P(0.13, 0.08, 0.34), P(0.13, 0.08, 0.78), P(0.13, -0.09, 0.78)], '#000000', { 'fill-opacity': 0.18 }));
    const cab = P(0, 0, 0.96);
    g.append(nodo('circle', { cx: cab[0], cy: cab[1], r: 6.5, fill: piel(id) }));
    g.append(nodo('path', { d: `M${cab[0] - 6.6} ${cab[1] + 0.5}a6.6 6.6 0 0 1 13.2 0c-2-2.6-11.2-2.6-13.2 0z`, fill: pelo(id) }));
    const t = P(0.2, 0.06, 0.62);
    g.append(nodo('g', { class: 'taza' }, nodo('rect', { x: t[0] - 2.5, y: t[1] - 3, width: 5, height: 6, rx: 1, fill: '#FFFFFF', stroke: '#B5A285', 'stroke-width': 0.6 })));
    return g;
  }
  // Puerta a la oficina de al lado, al final del pasillo de la izquierda
  function puertaOficina() {
    const g = nodo('g', { class: 'puerta-oficina', 'data-puerta': '1' });
    const x0 = PUERTA.x - 0.55, x1 = PUERTA.x + 0.55, y0 = PUERTA.y + 0.05, y1 = PUERTA.y + 0.2, alto = 1.55;
    const marco = { izq: '#FFFFFF', der: '#E6EBF2', techo: '#C9D7E6' };
    g.append(poli([P(x0 + 0.1, y1, 0), P(x1 - 0.1, y1, 0), P(x1 - 0.1, y1, alto), P(x0 + 0.1, y1, alto)], C.azul, { class: 'hueco-puerta' }));
    g.append(nodo('g', { transform: caraIzq(x0 + 0.1, y1, alto) }, ...[0, 1, 2].map((k) => nodo('rect', { class: 'luz-puerta', style: `--i:${k}`, x: 0.12 + k * 0.28, y: 0.35, width: 0.16, height: 0.9, fill: '#2A6496' }))));
    g.append(caja(x0, y0, x0 + 0.1, y1, 0, alto + 0.12, marco));
    g.append(caja(x1 - 0.1, y0, x1, y1, 0, alto + 0.12, marco));
    g.append(caja(x0, y0, x1, y1, alto, alto + 0.12, marco));
    return g;
  }

  // Trituradora de oficina: cuerpo gris, boca negra arriba, cubo transparente con tiras de papel y luz verde
  function trituradora() {
    const g = nodo('g', { class: 'trituradora', 'data-trituradora': '1' });
    const { x, y } = TRITURA, a = 0.24, b = 0.18;
    g.append(nodo('ellipse', { cx: P(x, y)[0], cy: P(x, y)[1], rx: 15, ry: 7.5, fill: '#000000', 'fill-opacity': 0.12 }));
    // cubo (abajo) y cabezal (arriba)
    g.append(caja(x - a, y - b, x + a, y + b, 0, 0.62, { izq: '#AEB7C2', der: '#97A1AD', techo: '#C9D1DA' }));
    const tiras = nodo('g', { class: 'tiras', transform: caraIzq(x - a + 0.04, y + b, 0.58) });
    for (let k = 0; k < 7; k++) tiras.append(nodo('rect', { class: 'tira', style: `--i:${k}`, x: 0.03 + k * 0.058, y: 0.18 + (k % 3) * 0.05, width: 0.03, height: 0.32 - (k % 3) * 0.05, fill: '#FFFFFF' }));
    g.append(tiras);
    g.append(caja(x - a - 0.02, y - b - 0.02, x + a + 0.02, y + b + 0.02, 0.62, 0.8, { izq: '#3A3F46', der: '#2E3238', techo: '#464B52' }));
    const boca = [P(x - a + 0.06, y - 0.03, 0.8), P(x + a - 0.06, y - 0.03, 0.8), P(x + a - 0.06, y + 0.03, 0.8), P(x - a + 0.06, y + 0.03, 0.8)];
    g.append(poli(boca, '#111317'));
    const l = P(x - a + 0.08, y + b + 0.02, 0.72);
    g.append(nodo('circle', { class: 'luz-tritura', cx: l[0], cy: l[1], r: 1.8 }));
    // hoja que entra (se anima con la clase «tritura»)
    const h = P(x, y, 0.8);
    g.append(nodo('g', { class: 'hoja-entra', transform: `translate(${h[0].toFixed(1)} ${h[1].toFixed(1)})` },
      nodo('rect', { x: -6, y: -14, width: 12, height: 14, rx: 1, fill: '#FFFFFF', stroke: '#C9D1DA', 'stroke-width': 0.6 }),
      nodo('line', { x1: -3.5, y1: -10, x2: 3.5, y2: -10, stroke: '#9DB8D4', 'stroke-width': 0.8 }),
      nodo('line', { x1: -3.5, y1: -7, x2: 2, y2: -7, stroke: '#9DB8D4', 'stroke-width': 0.8 })));
    return g;
  }

  // Sala de Ada: tarima, pantalla grande con su cara, consola y armarios de servidores
  function salaAda() {
    const s = ADA, m = s.s / 2, x0 = s.x - m, y0 = s.y - m, x1 = s.x + m, y1 = s.y + m;
    const g = nodo('g', { class: 'puesto sala-ada', 'data-id': 'ada', style: '--i:0' });
    g.append(nodo('ellipse', { class: 'aura', cx: P(s.x, s.y)[0], cy: P(s.x, s.y)[1], rx: (s.s + 0.8) * W, ry: (s.s + 0.8) * H, fill: 'none', 'stroke-width': 2.5 }));
    const c = nodo('g', { class: 'cuerpo' });
    for (let k = 0; k < 3; k++) c.append(nodo('ellipse', { class: 'onda-ada', style: `--i:${k}`, cx: P(s.x, s.y)[0], cy: P(s.x, s.y)[1], rx: m * 2 * W * 0.75, ry: m * 2 * H * 0.75, fill: 'none', 'stroke-width': 2 }));
    c.append(caja(x0, y0, x1, y1, 0, 0.12, { izq: '#B9CFE6', der: '#9DB8D4', techo: C.azulClaro }));
    // armario de servidores (izquierda)
    const rack = (ax, ay) => {
      const r = nodo('g', {});
      r.append(caja(ax, ay, ax + 0.4, ay + 0.4, 0.12, 1.45, { izq: '#2E3238', der: '#191C20', techo: '#3A3F46' }));
      r.append(nodo('g', { transform: caraIzq(ax, ay + 0.4, 1.4) }, ...Array.from({ length: 6 }, (_, k) => nodo('rect', { class: 'led', style: `--i:${k}`, x: 0.06 + (k % 2) * 0.18, y: 0.1 + Math.floor(k / 2) * 0.35, width: 0.1, height: 0.05 }))));
      return r;
    };
    c.append(rack(x0 + 0.1, y1 - 0.55));
    // pantalla grande
    const sx0 = x0 + 0.35, sx1 = x1 - 0.35, sy0 = y0 + 0.2, sy1 = sy0 + 0.1, sz0 = 0.75, sz1 = 2.35;
    c.append(caja(s.x - 0.1, sy0, s.x + 0.1, sy1, 0.12, sz0, C.pantalla));
    c.append(caja(sx0, sy0, sx1, sy1, sz0, sz1, { izq: C.azul, der: '#163E61', techo: '#2A6496' }));
    const ancho = sx1 - sx0, alto = sz1 - sz0;
    c.append(nodo('g', { class: 'cara-ada', transform: caraIzq(sx0, sy1, sz1) },
      nodo('rect', { class: 'ojo-ada', x: ancho * 0.3, y: alto * 0.24, width: 0.2, height: 0.48, rx: 0.1, fill: '#FFFFFF' }),
      nodo('rect', { class: 'ojo-ada', x: ancho * 0.6, y: alto * 0.24, width: 0.2, height: 0.48, rx: 0.1, fill: '#FFFFFF' }),
      nodo('path', { class: 'boca-ada', d: `M${ancho * 0.34} ${alto * 0.68} Q${ancho * 0.5} ${alto * 0.86} ${ancho * 0.7} ${alto * 0.68}`, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 0.1, 'stroke-linecap': 'round' })));
    // consola delante de la pantalla
    c.append(caja(s.x - 0.55, s.y + 0.15, s.x + 0.55, s.y + 0.5, 0.12, 0.55, { izq: '#E6EBF2', der: '#D3DEEA', techo: '#FFFFFF' }));
    c.append(nodo('g', { transform: `translate(0 0)` }, nodo('circle', { class: 'baliza', cx: P(s.x, s.y + 0.32, 0.6)[0], cy: P(s.x, s.y + 0.32, 0.6)[1], r: 3.5 })));
    g.append(c);
    return g;
  }

  // ---------- paquetes ----------
  function cubo(grande) {
    const t = grande ? 0.22 : 0.15, h = grande ? 0.36 : 0.26;
    const col = grande ? ['#2A6496', '#1D4F7A', '#5A8BB5'] : ['#E8B84A', '#C8962E', '#F6D58A'];
    const g = nodo('g', { class: 'paquete' + (grande ? ' campana' : '') },
      poli([P(-t, t, 0), P(t, t, 0), P(t, t, h), P(-t, t, h)], col[0]),
      poli([P(t, -t, 0), P(t, t, 0), P(t, t, h), P(t, -t, h)], col[1]),
      poli([P(-t, -t, h), P(t, -t, h), P(t, t, h), P(-t, t, h)], col[2]));
    if (grande) { // banderín
      const b = P(0, 0, h), a = P(0, 0, h + 0.75);
      g.append(nodo('line', { x1: b[0], y1: b[1], x2: a[0], y2: a[1], stroke: '#191C20', 'stroke-width': 1.2 }));
      g.append(poli([a, [a[0] + 13, a[1] + 4], [a[0], a[1] + 8]], C.ambar, { class: 'banderin' }));
    }
    return g;
  }

  // distancia con signo por el camino más corto del anillo
  const corta = (a, b) => { let d = ((b - a) % 4 + 4) % 4; if (d > 2) d -= 4; return d; };
  function medir(camino) {
    let total = 0; const tramos = [];
    for (let k = 1; k < camino.length; k++) { const l = Math.hypot(camino[k][0] - camino[k - 1][0], camino[k][1] - camino[k - 1][1]); tramos.push(l); total += l; }
    return { camino, tramos, total };
  }
  // Del puesto al café por el pasillo (y al revés para volver)
  function rutaCafe(id, hueco) {
    const s = sitioDe(id), m = (s.s || S) / 2, silla = [s.x + 0.1, s.y - m + 1.35];
    const dist = corta(s.anillo, ANILLO_CAFE), pasos = Math.max(1, Math.ceil(Math.abs(dist) * 4)), camino = [silla, enAnillo(s.anillo)];
    for (let k = 1; k <= pasos; k++) camino.push(enAnillo(s.anillo + (dist * k) / pasos));
    camino.push([CAFE.x0 + 0.3, CAFE.y], SITIOS_CAFE[hueco]);
    return medir(camino);
  }
  // Recorrido entre dos sitios por el pasillo, en el sentido del trabajo
  function ruta(desde, hasta) {
    const camino = [];
    let ini;
    if (desde === 'ada') {
      let mejor = SALIDAS[0], dist = 9;
      for (const sl of SALIDAS) { const d = Math.abs(corta(sl.anillo, sitioDe(hasta).anillo)); if (d < dist) { dist = d; mejor = sl; } }
      camino.push(mejor.desde); ini = mejor.anillo;
    } else { camino.push([sitioDe(desde).x, sitioDe(desde).y]); ini = sitioDe(desde).anillo; }
    const fin = sitioDe(hasta).anillo, dist = corta(ini, fin);
    camino.push(enAnillo(ini));
    const pasos = Math.max(1, Math.ceil(Math.abs(dist) * 4));
    for (let k = 1; k <= pasos; k++) camino.push(enAnillo(ini + (dist * k) / pasos));
    camino.push([sitioDe(hasta).x, sitioDe(hasta).y + 0.25]);
    return medir(camino);
  }
  function puntoRuta(r, d) {
    for (let k = 0; k < r.tramos.length; k++) {
      if (d <= r.tramos[k] || k === r.tramos.length - 1) { const f = r.tramos[k] ? Math.max(0, Math.min(1, d / r.tramos[k])) : 1, a = r.camino[k], b = r.camino[k + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
      d -= r.tramos[k];
    }
    return r.camino[r.camino.length - 1];
  }

  // ---------- estado de la escena ----------
  let raiz, svg, capa, capaCarteles, sala;
  const puestos = {}, carteles = {}, paquetes = [];
  // café: id → { g, hueco, estado: 'yendo' | 'alli' | 'volviendo', r, d }; puerta: a qué oficina lleva
  const cafe = {};
  let puerta = null, vecina = null, alIrA = null, proximoViaje = 0;
  let estados = {}, forzados = {}, alElegir = () => {}, ultimo = 0, proximaSalida = 0, angulo = 0, campanaActiva = null;

  const prof = (g) => Number(g.dataset.prof || 0);
  function colocar(g, p) {
    g.dataset.prof = p;
    let antes = null;
    for (const h of capa.children) if (h !== g && prof(h) > p) { antes = h; break; }
    if (antes) { if (g.nextSibling !== antes) capa.insertBefore(g, antes); } else if (capa.lastChild !== g) capa.append(g);
  }
  const estadoDe = (id) => forzados[id] || estados[id] || 'ok';

  function soltarPaquete() {
    // de vez en cuando un paquete va a la oficina de al lado o llega de ella
    if (puerta && performance.now() > proximoViaje) {
      proximoViaje = performance.now() + 6000 + Math.random() * 6000;
      const ids = Object.keys(puestos).filter((id) => estadoDe(id) !== 'pausa');
      if (Math.random() < 0.5 || !ids.length) lanzar('ada', 'puerta', false);
      else lanzar('puerta', ids[Math.floor(Math.random() * ids.length)], false);
      return;
    }
    const bolsa = [];
    for (const id of Object.keys(puestos)) {
      const e = estadoDe(id); if (e === 'pausa') continue;
      const peso = e === 'trabaja' ? 4 : e === 'aviso' ? 3 : e === 'error' ? 2 : 1;
      for (let k = 0; k < peso; k++) bolsa.push(id);
    }
    if (!bolsa.length || paquetes.filter((p) => !p.campana).length >= 8) return;
    const id = bolsa[Math.floor(Math.random() * bolsa.length)];
    lanzar('ada', id, false);
  }
  function lanzar(desde, hasta, campana, alLlegar) {
    const hay = (id) => (id === 'puerta' ? !!puerta : !!puestos[id]);
    if (!hay(hasta) || (desde !== 'ada' && !hay(desde))) return null;
    const g = cubo(campana); capa.append(g);
    const p = { g, hasta, r: ruta(desde, hasta), d: 0, v: campana ? 3.2 : 1.5 + Math.random() * 0.6, campana, alLlegar };
    paquetes.push(p);
    if (desde === 'ada') { sala.classList.remove('manda'); void sala.getBBox(); sala.classList.add('manda'); }
    return p;
  }

  let rafId = 0;
  // Trituradora: una hoja vuela desde quien la descarta hasta la boca y se tritura
  let tritura = null, alTriturar = null;
  function triturar(desde) {
    if (!tritura || !svg) return;
    const fin = P(TRITURA.x, TRITURA.y, 0.95);
    const s = desde && sitioDe(desde) ? sitioDe(desde) : ADA, ini = P(s.x, s.y, 1.2);
    const hoja = nodo('g', { class: 'hoja-vuela' }, nodo('rect', { x: -6, y: -8, width: 12, height: 15, rx: 1, fill: '#FFFFFF', stroke: '#9DB8D4', 'stroke-width': 0.8 }),
      nodo('line', { x1: -3.5, y1: -4, x2: 3.5, y2: -4, stroke: '#9DB8D4', 'stroke-width': 0.8 }), nodo('line', { x1: -3.5, y1: -1, x2: 2, y2: -1, stroke: '#9DB8D4', 'stroke-width': 0.8 }));
    const sacudir = () => { tritura.classList.remove('tritura'); void tritura.getBBox(); tritura.classList.add('tritura'); setTimeout(() => tritura && tritura.classList.remove('tritura'), 1600); };
    if (quieto || document.hidden) { sacudir(); return; }
    svg.append(hoja);
    const t0 = performance.now(), dur = 900;
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) * (1 - k);
      const x = ini[0] + (fin[0] - ini[0]) * e, y = ini[1] + (fin[1] - ini[1]) * e - Math.sin(Math.PI * k) * 60;
      hoja.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * 200).toFixed(0)})`);
      if (k < 1) requestAnimationFrame(paso); else { hoja.remove(); sacudir(); }
    };
    requestAnimationFrame(paso);
  }
  function ponerTrituradora(n) {
    let b = carteles.tritura;
    if (!b) {
      b = el('button', 'cartel cartel-tritura'); b.type = 'button';
      const ic = el('span', 'cartel-icono'); ic.append(icono('tritura'));
      const tx = el('span', 'cartel-texto'); tx.append(el('b', '', 'Trituradora'), el('small', 'cartel-estado'));
      b.append(ic, tx);
      b.addEventListener('click', () => alTriturar && alTriturar());
      b._p = [TRITURA.x + 0.3, TRITURA.y + 0.3, 1.25];
      capaCarteles.append(b); carteles.tritura = b;
    }
    b.querySelector('.cartel-estado').textContent = n ? `${n} para recuperar` : 'Vacía';
    b.setAttribute('aria-label', n ? `Trituradora: ${n} descartados que se pueden recuperar (30 días)` : 'Trituradora: vacía');
  }
  // Cámara: la vista actual se acerca poco a poco a la vista objetivo
  let vista = { ...VB }, objetivo = { ...VB };
  function ponerVista() {
    svg.setAttribute('viewBox', `${vista.x.toFixed(1)} ${vista.y.toFixed(1)} ${vista.w.toFixed(1)} ${vista.h.toFixed(1)}`);
    for (const c of Object.values(carteles)) {
      if (!c._p) continue;
      const [sx, sy] = P(...c._p);
      c.style.left = (((sx - vista.x) / vista.w) * 100).toFixed(2) + '%';
      c.style.top = (((sy - vista.y) / vista.h) * 100).toFixed(2) + '%';
    }
  }
  function enfocar(id) {
    const s = id ? sitioDe(id) : null;
    if (!s) objetivo = { ...VB };
    else {
      const k = id === 'ada' ? 2 : 2.4, w = VB.w / k, h = VB.h / k, [cx, cy] = P(s.x, s.y, id === 'ada' ? 1.2 : 0.7);
      objetivo = { x: cx - w / 2, y: cy - h / 2 - h * 0.06, w, h };
    }
    if (quieto || !rafId) { vista = { ...objetivo }; if (svg) ponerVista(); }
  }
  function fotograma(t) {
    rafId = requestAnimationFrame(fotograma);
    const dt = Math.min(0.05, (t - (ultimo || t)) / 1000); ultimo = t;
    if (document.hidden || !capa) return;
    if (t > proximaSalida) { soltarPaquete(); proximaSalida = t + 1000 + Math.random() * 1000; }
    for (let k = paquetes.length - 1; k >= 0; k--) {
      const p = paquetes[k]; p.d += p.v * dt;
      const [x, y] = puntoRuta(p.r, p.d), [sx, sy] = P(x, y), falta = p.r.total - p.d;
      const esc = p.campana ? 1 : Math.max(0, Math.min(1, falta / 0.5, p.d / 0.3));
      p.g.setAttribute('transform', `translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${esc.toFixed(2)})`);
      colocar(p.g, x + y + 0.3);
      if (falta <= 0) {
        if (!p.campana) p.g.remove();
        paquetes.splice(k, 1);
        const e = p.hasta === 'puerta' ? puerta : puestos[p.hasta]; if (e) { e.classList.remove('recibe'); void e.getBBox(); e.classList.add('recibe'); }
        if (p.alLlegar) p.alLlegar(p);
      }
    }
    if (Math.abs(vista.w - objetivo.w) > 0.3 || Math.abs(vista.x - objetivo.x) > 0.3 || Math.abs(vista.y - objetivo.y) > 0.3) {
      const f = Math.min(1, dt * 5);
      for (const k of ['x', 'y', 'w', 'h']) vista[k] += (objetivo[k] - vista[k]) * f;
      ponerVista();
    }
    for (const [id, c] of Object.entries(cafe)) {
      if (c.estado === 'alli') continue;
      c.d += 0.95 * dt;
      const d = c.estado === 'yendo' ? c.d : c.r.total - c.d;
      const [x, y] = puntoRuta(c.r, Math.max(0, Math.min(c.r.total, d))), [sx, sy] = P(x, y), bote = Math.abs(Math.sin(c.d * 9)) * 1.6;
      c.g.setAttribute('transform', `translate(${sx.toFixed(1)} ${(sy - bote).toFixed(1)})`);
      colocar(c.g, x + y + 0.35);
      if (c.d >= c.r.total) {
        if (c.estado === 'yendo') { c.estado = 'alli'; c.g.classList.remove('anda'); c.g.classList.add('en-cafe'); }
        else { c.g.remove(); delete cafe[id]; if (puestos[id]) puestos[id].classList.remove('fuera'); }
      }
    }
    angulo += dt * 1.6;
    const v = puestos.vigilante && puestos.vigilante.querySelector('.adorno');
    if (v && v.dataset.luz) {
      const [lx, ly] = v.dataset.luz.split(',').map(Number), lejos = estadoDe('vigilante') === 'error' ? 2.4 : 1.4, ab = 0.3;
      const a1 = P(Math.cos(angulo - ab) * lejos, Math.sin(angulo - ab) * lejos, -0.95), a2 = P(Math.cos(angulo + ab) * lejos, Math.sin(angulo + ab) * lejos, -0.95);
      v.querySelector('.haz').setAttribute('points', pts([lx, ly], [lx + a1[0], ly + a1[1]], [lx + a2[0], ly + a2[1]]));
    }
    const bob = puestos.montador && puestos.montador.querySelector('.bobina');
    if (bob) bob.setAttribute('transform', `rotate(${((angulo * (estadoDe('montador') === 'trabaja' ? 170 : 35)) % 360).toFixed(1)} 0.22 0.22)`);
  }


  // Quita la oficina y para todo (el Laboratorio la monta y desmonta al cambiar de proyecto)
  function desmontar() {
    cancelAnimationFrame(rafId); rafId = 0;
    quitarFrente(); removeEventListener('resize', alCambiarTamano);
    if (campanaActiva) campanaActiva();
    for (const p of paquetes) p.g.remove();
    paquetes.length = 0;
    for (const k of Object.keys(puestos)) delete puestos[k];
    for (const k of Object.keys(carteles)) delete carteles[k];
    for (const k of Object.keys(asignados)) delete asignados[k];
    for (const k of Object.keys(cafe)) delete cafe[k];
    puerta = null; vecina = null; proximoViaje = 0; tritura = null; alTriturar = null;
    estados = {}; forzados = {}; vista = { ...VB }; objetivo = { ...VB }; ultimosDatos = null; ultimoElegido = null; ultimo = 0; proximaSalida = 0;
    if (raiz) { raiz.replaceChildren(); raiz.classList.remove('mundo', 'con-elegido', 'acercado'); }
    raiz = svg = capa = capaCarteles = sala = null;
  }

  function montar(contenedor, opciones = {}) {
    if (raiz) desmontar();
    raiz = contenedor; alElegir = opciones.alElegir || (() => {});
    raiz.classList.add('mundo');
    svg = nodo('svg', { class: 'mundo-svg', viewBox: `${VB.x} ${VB.y} ${VB.w} ${VB.h}`, 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' });
    svg.append(suelo(), muros());
    capa = nodo('g', { class: 'cosas' });
    svg.append(capa);
    sala = salaAda(); sala.dataset.prof = ADA.x + ADA.y; capa.append(sala);
    alIrA = opciones.alIrA || null;
    const barra = barraCafe(); barra.dataset.prof = CAFE.x0 + CAFE.y0 + 1; capa.append(barra);
    for (const [x, y] of [[13.0, 4.05], [13.85, 5.05]]) { const m = mesaCafe(x, y); colocar(m, x + y); }
    alTriturar = opciones.alTriturar || null;
    if (alTriturar) { tritura = trituradora(); colocar(tritura, TRITURA.x + TRITURA.y); }
    raiz.append(svg);
    capaCarteles = document.createElement('div'); capaCarteles.className = 'carteles';
    raiz.append(capaCarteles);
    svg.addEventListener('click', (e) => {
      if (e.target.closest('[data-puerta]')) { if (vecina && alIrA) alIrA(vecina.id); return; }
      if (e.target.closest('[data-trituradora]')) { if (alTriturar) alTriturar(); return; }
      const g = e.target.closest('[data-id]'); if (g) alElegir(g.dataset.id);
    });
    svg.addEventListener('pointerover', (e) => { const g = e.target.closest('.puesto'); marcar(g ? g.dataset.id : null); });
    svg.addEventListener('pointerleave', () => marcar(null));
    if (!quieto) rafId = requestAnimationFrame(fotograma);
    addEventListener('resize', alCambiarTamano);
  }
  // Si la ventana pasa de ancha a estrecha (o al revés) con un puesto de frente, se vuelve a dibujar
  function alCambiarTamano() { if (frenteEl && raiz && (raiz.clientWidth < 560) !== raiz.classList.contains('estrecho')) ponerFrente(frenteId); }

  function marcar(id) {
    for (const [k, c] of Object.entries(carteles)) c.classList.toggle('encima', k === id);
    for (const [k, g] of Object.entries(puestos)) g.classList.toggle('encima', k === id);
    sala.classList.toggle('encima', id === 'ada');
  }

  const ESTADO_TXT = { ok: 'Al día', trabaja: 'Trabajando', aviso: 'Te espera', error: 'Con error', pausa: 'En pausa' };
  function el(tag, cls, texto) { const e = document.createElement(tag); if (cls) e.className = cls; if (texto !== undefined) e.textContent = texto; return e; }

  function cartel(w) {
    const b = el('button', 'cartel'); b.type = 'button'; b.dataset.id = w.id;
    const ic = el('span', 'cartel-icono'); ic.append(icono(w.icono));
    const tx = el('span', 'cartel-texto'); tx.append(el('b', '', w.nombre), el('small', 'cartel-estado'), el('small', 'cartel-frase'));
    b.append(ic, tx, el('span', 'cartel-insignia'));
    b.addEventListener('click', () => alElegir(w.id));
    b.addEventListener('pointerenter', () => marcar(w.id)); b.addEventListener('pointerleave', () => marcar(null));
    b.addEventListener('focus', () => marcar(w.id)); b.addEventListener('blur', () => marcar(null));
    return b;
  }

  // Pinta estados, carteles y selección con los datos del panel (o de la simulación)
  function pintar(datos, elegido) {
    estados = Object.fromEntries(datos.trabajadores.map((w) => [w.id, w.estado]));
    // los puestos salen de los datos: si IT añade o quita un worker, la oficina se reordena sola
    const ids = new Set(datos.trabajadores.map((w) => w.id));
    for (const id of Object.keys(puestos)) if (!ids.has(id)) {
      puestos[id].remove(); delete puestos[id];
      if (cafe[id]) { cafe[id].g.remove(); delete cafe[id]; }
      if (carteles[id]) { carteles[id].remove(); delete carteles[id]; }
      delete asignados[id];
    }
    repartir([...ids]);
    datos.trabajadores.forEach((w, i) => {
      if (puestos[w.id]) return;
      const s = sitioDe(w.id); if (!s) return;
      const g = puesto(w.id, s, i + 1); puestos[w.id] = g; colocar(g, s.x + s.y);
    });
    let nuevos = ponerPuerta(datos);
    if (tritura) ponerTrituradora((datos.papelera || []).length);
    // con el PC apagado, los que trabajan en él se van al café (andando, salvo al cargar la oficina)
    const derecho = !ultimosDatos || quieto || document.hidden;
    for (const w of datos.trabajadores) {
      if (!puestos[w.id]) continue;
      const c = cafe[w.id];
      if (w.cafe && (!c || c.estado === 'volviendo')) irAlCafe(w.id, derecho);
      else if (!w.cafe && c && c.estado !== 'volviendo') volverDelCafe(w.id, derecho);
    }
    for (const w of datos.trabajadores) {
      const s = sitioDe(w.id), g = puestos[w.id]; if (!s || !g) continue;
      const est = estadoDe(w.id);
      g.setAttribute('class', `puesto ${est}${elegido === w.id ? ' elegido' : ''}${g.classList.contains('encima') ? ' encima' : ''}${cafe[w.id] ? ' fuera' : ''}`);
      let c = carteles[w.id];
      if (!c) {
        c = cartel(w); c._p = [s.x + 0.1, s.y + 0.3, 1.25]; c.style.setProperty('--i', Object.keys(carteles).length);
        capaCarteles.append(c); carteles[w.id] = c; nuevos = true;
      }
      c.className = `cartel ${est}${elegido === w.id ? ' elegido' : ''}`;
      c.setAttribute('aria-label', `${w.nombre}: ${w.cafe && est === 'pausa' ? 'En el café' : ESTADO_TXT[est]}. ${forzados[w.id + ':frase'] || w.frase}`);
      c.querySelector('.cartel-estado').textContent = w.cafe && est === 'pausa' ? 'En el café' : ESTADO_TXT[est];
      c.querySelector('.cartel-frase').textContent = forzados[w.id + ':frase'] || '';
      const cifra = w.id === 'contable' ? null : w.cifra;
      const ins = c.querySelector('.cartel-insignia');
      ins.textContent = cifra > 0 ? (cifra > 99 ? '99+' : String(cifra)) : '';
      ins.hidden = !(cifra > 0);
    }
    sala.setAttribute('class', `puesto sala-ada ${datos.ada.estado}${elegido === 'ada' ? ' elegido' : ''}`);
    if (!carteles.ada) {
      const b = el('button', 'bocadillo'); b.type = 'button'; b.id = 'bocadillo';
      b.addEventListener('click', () => alElegir('ada'));
      b._p = [ADA.x - 0.6, ADA.y - 0.6, 2.75];
      capaCarteles.append(b); carteles.ada = b;
      const volver = el('button', 'ver-todo', 'Ver toda la oficina'); volver.type = 'button';
      volver.addEventListener('click', () => { if (ultimoElegido) alElegir(ultimoElegido); });
      raiz.append(volver);
      nuevos = true;
    }
    // los carteles nuevos (p. ej. al volver de otra oficina) se colocan ya, sin esperar a que se mueva la cámara
    if (nuevos) ponerVista();
    const cambia = elegido !== ultimoElegido;
    if (cambia || !ultimosDatos) enfocar(elegido);
    raiz.classList.toggle('con-elegido', !!elegido);
    raiz.classList.toggle('acercado', !!elegido);
    ultimosDatos = datos; ultimoElegido = elegido;
    // primero se acerca la cámara y luego aparece su puesto visto de frente
    if (cambia) { quitarFrente(); if (elegido) tFrente = setTimeout(() => ponerFrente(elegido), quieto ? 0 : 650); }
    else actualizarFrente();
  }
  let ultimosDatos = null, ultimoElegido = null;

  function irAlCafe(id, derecho) {
    let c = cafe[id];
    if (c) { c.estado = 'yendo'; c.d = c.r.total - c.d; c.g.classList.add('anda'); return; }
    const usados = new Set(Object.values(cafe).map((x) => x.hueco));
    const hueco = SITIOS_CAFE.findIndex((_, k) => !usados.has(k));
    if (hueco < 0) return; // café lleno: se queda dormido en su puesto
    const g = figura(id); g.dataset.prof = 0; capa.append(g);
    c = cafe[id] = { g, hueco, r: rutaCafe(id, hueco), d: 0, estado: 'yendo' };
    puestos[id].classList.add('fuera');
    if (derecho) c.d = c.r.total; else g.classList.add('anda');
    const [sx, sy] = P(...c.r.camino[derecho ? c.r.camino.length - 1 : 0]);
    g.setAttribute('transform', `translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);
    if (derecho) { c.estado = 'alli'; g.classList.add('en-cafe'); const [x, y] = SITIOS_CAFE[hueco]; colocar(g, x + y + 0.35); }
  }
  function volverDelCafe(id, derecho) {
    const c = cafe[id]; if (!c) return;
    if (derecho) { c.g.remove(); delete cafe[id]; if (puestos[id]) puestos[id].classList.remove('fuera'); return; }
    c.d = c.estado === 'yendo' ? c.r.total - c.d : 0;
    c.estado = 'volviendo'; c.g.classList.remove('en-cafe'); c.g.classList.add('anda');
  }
  // La puerta lleva a la oficina siguiente de la lista (solo si hay más de una)
  function ponerPuerta(datos) {
    const ofs = datos.oficinas || [];
    const i = ofs.findIndex((o) => o.id === (datos.oficina || 'marketing'));
    vecina = ofs.length > 1 ? ofs[(i + 1) % ofs.length] : null;
    if (vecina && vecina.id === datos.oficina) vecina = null;
    raiz.classList.toggle('con-puerta', !!vecina);
    if (!vecina) { if (puerta) { puerta.remove(); puerta = null; } if (carteles.puerta) { carteles.puerta.remove(); delete carteles.puerta; } return false; }
    if (!puerta) { puerta = puertaOficina(); colocar(puerta, PUERTA.x + PUERTA.y); }
    let nuevo = false, b = carteles.puerta;
    if (!b) {
      b = el('button', 'cartel cartel-puerta'); b.type = 'button';
      const ic = el('span', 'cartel-icono'); ic.append(icono('puerta'));
      const tx = el('span', 'cartel-texto'); tx.append(el('small', 'cartel-estado', 'Pasar a'), el('b', ''));
      b.append(ic, tx);
      b.addEventListener('click', () => { if (vecina && alIrA) alIrA(vecina.id); });
      b._p = [PUERTA.x - 0.1, PUERTA.y + 0.2, 2.05];
      capaCarteles.append(b); carteles.puerta = b; nuevo = true;
    }
    b.querySelector('b').textContent = vecina.nombre;
    b.setAttribute('aria-label', `Ir a la oficina ${vecina.nombre}`);
    return nuevo;
  }
  const repintar = () => { if (ultimosDatos && raiz) pintar(ultimosDatos, ultimoElegido); };

  // Una campaña de mentira que recorre los puestos uno a uno. Solo visual: no toca datos.
  // pasos: [{ id, frase, ms }]. Devuelve una función para pararla.
  function campana(pasos, { alPaso, alAcabar } = {}) {
    if (campanaActiva) campanaActiva();
    let vivo = true, actual = null, paquete = null, temporizador = 0;
    const parar = () => { vivo = false; clearTimeout(temporizador); if (paquete) paquete.g.remove(); if (actual) { delete forzados[actual]; delete forzados[actual + ':frase']; } campanaActiva = null; repintar(); };
    campanaActiva = parar;
    const ir = (k, desde) => {
      if (!vivo) return;
      if (k >= pasos.length) { if (paquete) paquete.g.remove(); campanaActiva = null; if (alAcabar) alAcabar(); return; }
      const paso = pasos[k];
      const llegar = () => {
        if (!vivo) return;
        if (actual) { delete forzados[actual]; delete forzados[actual + ':frase']; }
        actual = paso.id; forzados[paso.id] = 'trabaja'; forzados[paso.id + ':frase'] = paso.frase; repintar();
        if (alPaso) alPaso(paso, k);
        temporizador = setTimeout(() => { if (!vivo) return; delete forzados[paso.id]; delete forzados[paso.id + ':frase']; repintar(); if (paquete) paquete.g.remove(); ir(k + 1, paso.id); }, quieto ? 400 : paso.ms || 2600);
      };
      if (quieto || !capa) { llegar(); return; }
      paquete = lanzar(desde, paso.id, true, llegar);
      if (!paquete) llegar(); // ese worker no está en la oficina
    };
    ir(0, 'ada');
    return parar;
  }


  // ---------- vista de frente: al elegir un worker, su puesto visto de cara, con sus herramientas ----------
  // Solo nombres de las herramientas (sin logos de otras marcas). Fuente: docs/procesos/README.md («Quién hace qué»).
  const HERRAMIENTAS = {
    ada: [
      { n: 'n8n', d: 'Flujos, horarios y la cola', ic: 'nodos', c: '#B3261E' },
      { n: 'ChatGPT API', d: 'Piensa con gpt-5-mini (solo texto)', ic: 'chat', c: '#1E6B4E' },
      { n: 'Claude', d: 'Hace el resto del trabajo', ic: 'chispa', c: '#8A5A00' },
      { n: 'Correo', d: 'Te manda el resumen y «Parar»', ic: 'correo', c: '#1D4F7A' },
    ],
    guionista: [
      { n: 'ChatGPT API', d: 'Escribe las historias de la semana', ic: 'chat', c: '#1E6B4E' },
      { n: 'Claude', d: 'Deja el guion final', ic: 'chispa', c: '#8A5A00' },
      { n: 'historias_semana', d: 'Tabla de n8n con las historias', ic: 'tabla', c: '#1D4F7A' },
      { n: 'n8n', d: 'Lo lanza los sábados a las 10:00', ic: 'nodos', c: '#B3261E' },
    ],
    ilustrador: [
      { n: 'ChatGPT web', d: 'Portadas e imágenes, en tu Chrome', ic: 'navegador', c: '#1E6B4E' },
      { n: 'Gemini web', d: 'Imágenes gratis', ic: 'chispa', c: '#1D4F7A' },
      { n: 'imagenes_pendientes', d: 'Los encargos de imágenes', ic: 'tabla', c: '#7A4F9A' },
      { n: 'OneDrive', d: 'Guarda cada imagen en su vídeo', ic: 'nube', c: '#5A8BB5' },
    ],
    voz: [
      { n: 'Google AI Studio', d: 'Voces de Koda y Elio, en diálogo', ic: 'chispa', c: '#1D4F7A' },
      { n: 'tts.py', d: 'Corta una frase por fichero', ic: 'codigo', c: '#1E6B4E' },
      { n: 'Chrome de Luis', d: 'Sin clave de API: usa tu sesión', ic: 'navegador', c: '#8A5A00' },
      { n: 'OneDrive', d: 'Deja las voces en la carpeta voz/', ic: 'nube', c: '#5A8BB5' },
    ],
    montador: [
      { n: 'motor.py', d: 'Monta el vídeo y los clips', ic: 'codigo', c: '#1E6B4E' },
      { n: 'ffmpeg', d: 'Vídeo final y portada .jpg', ic: 'pelicula', c: '#8A5A00' },
      { n: 'Claude', d: 'Decide cortes y textos', ic: 'chispa', c: '#7A4F9A' },
      { n: 'OneDrive', d: 'Canales/<canal>/', ic: 'nube', c: '#5A8BB5' },
    ],
    revisor: [
      { n: 'n8n · 20:00', d: 'Revisa lo que sale mañana', ic: 'nodos', c: '#B3261E' },
      { n: 'Correo', d: 'Te avisa con el botón «Parar»', ic: 'correo', c: '#1D4F7A' },
      { n: 'cola_publicaciones', d: 'La cola de lo que sale', ic: 'tabla', c: '#7A4F9A' },
      { n: 'Cada 30 min', d: 'Mira lo urgente', ic: 'reloj', c: '#8A5A00' },
    ],
    publicador: [
      { n: 'Buffer', d: '2 cuentas, 5 canales', ic: 'capas', c: '#191C20' },
      { n: 'YouTube API', d: 'Sube los vídeos', ic: 'play', c: '#B3261E' },
      { n: 'n8n · cada 15 min', d: 'Publica lo aprobado a su hora', ic: 'nodos', c: '#8A5A00' },
      { n: 'Máx. 3 al día', d: 'Por red y por cuenta', ic: 'reloj', c: '#1D4F7A' },
    ],
    linkedin: [
      { n: 'LinkedIn', d: 'Una publicación al día', ic: 'in', c: '#0A66C2' },
      { n: 'Buffer · cuenta 2', d: 'La programa a su hora', ic: 'capas', c: '#191C20' },
      { n: 'ChatGPT API', d: 'Prepara el borrador', ic: 'chat', c: '#1E6B4E' },
      { n: 'Tu OK', d: 'Sale solo si lo apruebas', ic: 'hecho', c: '#8A5A00' },
    ],
    vigilante: [
      { n: 'Latido del PC', d: 'Sabe si tu PC está encendido', ic: 'latido', c: '#B3261E' },
      { n: 'n8n · errores', d: 'Recoge cada fallo de los flujos', ic: 'nodos', c: '#8A5A00' },
      { n: 'registro_eventos', d: 'Apunta todo lo que pasa', ic: 'tabla', c: '#1D4F7A' },
      { n: 'Correo', d: 'Te avisa si algo se rompe', ic: 'correo', c: '#1E6B4E' },
    ],
    contable: [
      { n: 'Gasto de OpenAI', d: 'Lo que lleva el mes', ic: 'moneda', c: '#1E6B4E' },
      { n: 'Tope de aviso', d: 'Avisa al pasar de 5 $', ic: 'alerta', c: '#8A5A00' },
      { n: 'Nada de pago nuevo', d: 'Solo lo que ya tienes', ic: 'hecho', c: '#1D4F7A' },
    ],
  };

  const FW = 830, FH = 515, FH_ESTRECHO = 1130;
  const R = (x, y, w, h, fill, ex = {}) => nodo('rect', { x, y, width: w, height: h, fill, ...ex });
  const T = (x, y, txt, ex = {}) => nodo('text', { x, y, ...ex }, document.createTextNode(txt));
  function partir(txt, max) {
    const l = []; let a = '';
    for (const p of txt.split(' ')) { if (a && (a + ' ' + p).length > max) { l.push(a); a = p; } else a = a ? a + ' ' + p : p; }
    if (a) l.push(a);
    return l.slice(0, 2);
  }
  function icoEn(n, x, y, tam, color) {
    const g = nodo('g', { transform: `translate(${x} ${y}) scale(${tam / 24})`, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    for (const d of ICONOS[n] || []) g.append(nodo('path', { d }));
    return g;
  }

  // Pantalla grande de la pared: lo que está haciendo cada uno (x,y: esquina; w,h: tamaño)
  function contenidoPantalla(id, x, y, w, h) {
    const g = nodo('g', { class: 'fp-contenido' });
    switch (id) {
      case 'guionista':
        for (let k = 0; k < 6; k++) g.append(R(x + 14, y + 14 + k * 16, (w - 28) * [1, .86, .94, .6, .9, .45][k], 7, '#D3E4F5', { class: 'fp-linea', rx: 2, style: `--k:${k}` }));
        g.append(R(x + 14, y + 14 + 6 * 16 - 2, 3, 11, '#FFFFFF', { class: 'fp-cursor' }));
        break;
      case 'ilustrador': {
        g.append(R(x + 10, y + 10, w - 20, h - 20, '#D3E4F5', { rx: 4 }));
        g.append(nodo('circle', { class: 'fp-sol', cx: x + w - 46, cy: y + 34, r: 13, fill: '#E8B84A' }));
        g.append(nodo('path', { class: 'fp-monte', d: `M${x + 10} ${y + h - 10}l46-50 30 28 38-44 ${w - 134} 66z`, fill: '#5A8BB5' }));
        g.append(nodo('path', { class: 'fp-monte fp-monte2', d: `M${x + 10} ${y + h - 10}l70-30 40 18 50-26 ${w - 170} 38z`, fill: '#1E6B4E' }));
        break;
      }
      case 'voz':
        for (let k = 0; k < 18; k++) { const bh = 14 + ((k * 37) % 50); g.append(R(x + 14 + k * ((w - 28) / 18), y + h / 2 - bh / 2, 5, bh, '#5BC08A', { class: 'fp-barra', rx: 2.5, style: `--k:${k}` })); }
        break;
      case 'montador': {
        const cols = [['#5A8BB5', '#8A5A00', '#5A8BB5'], ['#5BC08A', '#5BC08A'], ['#E8B84A', '#7A4F9A', '#E8B84A']];
        cols.forEach((fila, f) => { let cx = x + 12; fila.forEach((col, i) => { const ww = (w - 24) / fila.length - 4; g.append(R(cx, y + 18 + f * 30, ww, 20, col, { rx: 3, class: 'fp-clip', style: `--k:${f * 3 + i}` })); cx += ww + 4; }); });
        g.append(R(x + 12, y + 8, 2.5, h - 16, '#FFFFFF', { class: 'fp-cabezal' }));
        break;
      }
      case 'revisor':
        for (let k = 0; k < 4; k++) {
          const yy = y + 16 + k * 24;
          g.append(R(x + 14, yy, 14, 14, 'none', { stroke: '#D3E4F5', 'stroke-width': 2, rx: 3 }));
          g.append(nodo('path', { class: 'fp-tick', style: `--k:${k}`, d: `M${x + 17} ${yy + 7}l3 3 6-6`, fill: 'none', stroke: '#5BC08A', 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
          g.append(R(x + 36, yy + 4, (w - 54) * [1, .7, .85, .55][k], 6, '#D3E4F5', { rx: 2 }));
        }
        break;
      case 'publicador':
        for (let k = 0; k < 21; k++) g.append(R(x + 12 + (k % 7) * ((w - 24) / 7), y + 26 + Math.floor(k / 7) * 26, (w - 24) / 7 - 4, 21, '#2A6496', { rx: 3, class: 'fp-celda', style: `--k:${k}` }));
        g.append(R(x + 12, y + 8, w - 24, 12, '#D3E4F5', { rx: 3 }));
        break;
      case 'linkedin':
        g.append(R(x + 22, y + 10, w - 44, h - 20, '#FFFFFF', { rx: 6 }));
        g.append(nodo('circle', { cx: x + 40, cy: y + 28, r: 9, fill: '#0A66C2' }));
        g.append(R(x + 56, y + 22, 70, 6, '#C9D7E6', { rx: 2 })); g.append(R(x + 56, y + 31, 44, 5, '#DCE3EB', { rx: 2 }));
        for (let k = 0; k < 3; k++) g.append(R(x + 32, y + 48 + k * 11, (w - 64) * [1, .9, .6][k], 6, '#DCE3EB', { rx: 2 }));
        for (let k = 0; k < 3; k++) g.append(nodo('circle', { class: 'fp-like', style: `--k:${k}`, cx: x + 42 + k * 16, cy: y + h - 22, r: 6, fill: ['#0A66C2', '#B3261E', '#1E6B4E'][k] }));
        break;
      case 'vigilante':
        for (let k = 0; k < 4; k++) g.append(R(x + 10 + (k % 2) * ((w - 20) / 2), y + 8 + Math.floor(k / 2) * 40, (w - 20) / 2 - 4, 36, '#2E3238', { class: 'camara', style: `--i:${k}` }));
        g.append(nodo('polyline', { class: 'fp-latido', points: `${x + 10},${y + h - 16} ${x + 50},${y + h - 16} ${x + 60},${y + h - 30} ${x + 72},${y + h - 4} ${x + 82},${y + h - 16} ${x + w - 10},${y + h - 16}`, fill: 'none', stroke: '#5BC08A', 'stroke-width': 2.5 }));
        break;
      default:
        for (let k = 0; k < 5; k++) g.append(R(x + 14, y + 16 + k * 18, (w - 28) * [1, .7, .9, .5, .8][k], 8, '#D3E4F5', { class: 'fp-linea', rx: 2, style: `--k:${k}` }));
        break;
      case 'pedidos': // pedidos que llegan, se leen y quedan confirmados
        for (let k = 0; k < 3; k++) {
          const yy = y + 12 + k * 36;
          g.append(nodo('g', { class: 'fp-pedido', style: `--k:${k}` },
            R(x + 12, yy, w - 24, 30, '#FFFFFF', { rx: 5 }),
            R(x + 20, yy + 7, 16, 16, ['#E8B84A', '#5A8BB5', '#7A4F9A'][k], { rx: 3 }),
            R(x + 44, yy + 8, (w - 100) * [1, .7, .85][k], 6, '#C9D7E6', { rx: 2 }),
            R(x + 44, yy + 18, (w - 100) * .45, 5, '#DCE3EB', { rx: 2 }),
            nodo('path', { class: 'fp-pedido-ok', d: `M${x + w - 34} ${yy + 15}l4 4 8-8`, fill: 'none', stroke: '#1E6B4E', 'stroke-width': 3, 'stroke-linecap': 'round' })));
        }
        break;
      case 'tendencias':
        for (let k = 0; k < 4; k++) g.append(R(x + 12, y + 20 + k * 24, w - 24, 1.5, '#2A6496'));
        g.append(nodo('polyline', { class: 'fp-tendencia', points: `${x + 14},${y + h - 18} ${x + 44},${y + h - 34} ${x + 74},${y + h - 28} ${x + 104},${y + h - 58} ${x + 134},${y + h - 50} ${x + w - 18},${y + 18}`, fill: 'none', stroke: '#5BC08A', 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
        g.append(nodo('circle', { class: 'fp-tendencia-punto', cx: x + w - 18, cy: y + 18, r: 5, fill: '#E8B84A' }));
        break;
      case 'clientes':
        for (let k = 0; k < 3; k++) {
          const xx = x + 12 + k * ((w - 24) / 3);
          g.append(nodo('g', { class: 'fp-cliente', style: `--k:${k}` },
            R(xx, y + 16, (w - 24) / 3 - 8, h - 32, '#FFFFFF', { rx: 6 }),
            nodo('circle', { cx: xx + ((w - 24) / 3 - 8) / 2, cy: y + 40, r: 12, fill: ['#5A8BB5', '#E8B84A', '#7A4F9A'][k] }),
            R(xx + 8, y + 62, (w - 24) / 3 - 24, 6, '#C9D7E6', { rx: 2 }),
            R(xx + 14, y + 74, (w - 24) / 3 - 36, 5, '#DCE3EB', { rx: 2 })));
        }
        break;
      case 'graficos':
        g.append(nodo('circle', { cx: x + w - 40, cy: y + 40, r: 22, fill: 'none', stroke: '#2A6496', 'stroke-width': 10 }));
        g.append(nodo('circle', { class: 'fp-donut', cx: x + w - 40, cy: y + 40, r: 22, fill: 'none', stroke: '#E8B84A', 'stroke-width': 10, 'stroke-dasharray': '138', 'stroke-dashoffset': '138' }));
        for (let k = 0; k < 4; k++) { const bh = 18 + k * 13; g.append(R(x + 16 + k * 26, y + h - 14 - bh, 18, bh, k === 3 ? '#E8B84A' : '#5A8BB5', { class: 'fp-columna', style: `--k:${k}`, rx: 2 })); }
        break;
      case 'contable':
        for (let k = 0; k < 6; k++) { const bh = 20 + k * 11; g.append(R(x + 18 + k * ((w - 36) / 6), y + h - 12 - bh, (w - 36) / 6 - 8, bh, k === 5 ? '#E8B84A' : '#5A8BB5', { class: 'fp-columna', style: `--k:${k}`, rx: 2 })); }
        break;
    }
    return g;
  }

  // Lo que hay en la pared y en la mesa de cada uno, visto de frente
  function decorado(id, w) {
    const fondo = nodo('g', { class: 'fp-pared' }), mesa = nodo('g', { class: 'fp-mesa-cosas' });
    switch (id) {
      case 'voz': {
        // paneles de espuma a los lados de la pantalla y cartel «EN EL AIRE»
        for (const bx of [252, 520]) for (let f = 0; f < 4; f++) for (let c = 0; c < 2; c++) {
          const px = bx + c * 30, py = 52 + f * 30;
          fondo.append(R(px, py, 28, 28, '#B4C6DA', { rx: 2 }));
          fondo.append(nodo('path', { d: (f + c) % 2 ? `M${px} ${py + 9}h28M${px} ${py + 19}h28` : `M${px + 9} ${py}v28M${px + 19} ${py}v28`, stroke: '#9DB8D4', 'stroke-width': 2 }));
        }
        fondo.append(nodo('g', { class: 'fp-enelaire' }, R(355, 12, 120, 26, '#5A5F67', { rx: 6 }), T(415, 30, 'EN EL AIRE', { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, fill: '#FFFFFF', 'letter-spacing': 1 })));
        // mesa de mezclas con faders
        mesa.append(R(270, 306, 92, 22, '#3A3F46', { rx: 4 }));
        for (let k = 0; k < 4; k++) { mesa.append(R(282 + k * 20, 310, 3, 14, '#191C20')); mesa.append(R(277 + k * 20, 314, 13, 6, '#E8B84A', { rx: 2, class: 'fp-fader', style: `--k:${k}` })); }
        break;
      }
      case 'guionista':
        fondo.append(R(256, 56, 50, 104, '#C9B79C', { rx: 4 }));
        [['#FBEFD3', 262, 64], ['#D3E4F5', 280, 84], ['#F9DEDC', 262, 108], ['#DDEFE5', 282, 128]].forEach(([col, px, py], k) => fondo.append(R(px, py, 20, 20, col, { class: 'fp-nota', style: `--k:${k}` })));
        mesa.append(R(262, 314, 52, 12, '#FFFFFF', { stroke: '#C9D7E6' })); mesa.append(R(266, 308, 52, 8, '#FFFFFF', { stroke: '#C9D7E6' }));
        for (let k = 0; k < 3; k++) mesa.append(nodo('g', { transform: 'translate(290 304)' }, nodo('g', { class: 'fp-hoja', style: `--k:${k}` }, R(-10, -7, 20, 14, '#FFFFFF', { stroke: '#1D4F7A', 'stroke-width': 0.8 }))));
        mesa.append(R(538, 304, 22, 24, '#FFFFFF', { rx: 3, stroke: '#C9D7E6' })); mesa.append(nodo('path', { d: 'M560 310q9 0 9 7t-9 7', fill: 'none', stroke: '#C9D7E6', 'stroke-width': 3 }));
        for (let k = 0; k < 2; k++) mesa.append(nodo('path', { class: 'fp-vapor', style: `--k:${k}`, d: `M${544 + k * 8} 298q-4-6 0-12t0-12`, fill: 'none', stroke: '#9AA3AD', 'stroke-width': 2, 'stroke-linecap': 'round' }));
        break;
      case 'ilustrador':
        fondo.append(R(258, 60, 44, 34, '#FFFFFF', { stroke: '#C9B79C', 'stroke-width': 4 })); fondo.append(nodo('path', { d: 'M262 90l12-14 8 8 8-10 8 16z', fill: '#5A8BB5' }));
        fondo.append(R(530, 74, 40, 50, '#FFFFFF', { stroke: '#C9B79C', 'stroke-width': 4 })); fondo.append(nodo('circle', { cx: 550, cy: 96, r: 9, fill: '#7A4F9A' }));
        mesa.append(nodo('ellipse', { cx: 296, cy: 318, rx: 32, ry: 11, fill: '#E2D4BD', stroke: '#B5A285', 'stroke-width': 2 }));
        ['#1D4F7A', '#B3261E', '#E8B84A', '#1E6B4E'].forEach((col, k) => mesa.append(nodo('circle', { class: 'fp-gota', style: `--k:${k}`, cx: 278 + k * 12, cy: 316, r: 4.5, fill: col })));
        mesa.append(nodo('g', { class: 'fp-pincel' }, nodo('line', { x1: 540, y1: 326, x2: 566, y2: 286, stroke: '#8A5A00', 'stroke-width': 4, 'stroke-linecap': 'round' }), nodo('circle', { cx: 566, cy: 286, r: 4, fill: '#7A4F9A' })));
        break;
      case 'montador':
        for (let k = 0; k < 9; k++) fondo.append(R(250 + k * 38, 14, 30, 20, '#3A3F46', { rx: 2 }));
        mesa.append(nodo('g', { class: 'fp-claqueta' }, R(266, 304, 50, 22, '#2E3238', { rx: 2 }), nodo('g', { class: 'fp-tapa' }, R(266, 296, 50, 8, '#FFFFFF'), ...[0, 1, 2].map((k) => R(270 + k * 16, 296, 8, 8, '#2E3238')))));
        mesa.append(nodo('g', { transform: 'translate(550 306)' }, nodo('g', { class: 'fp-rollo' }, nodo('circle', { r: 20, fill: '#FFFFFF', stroke: '#8A5A00', 'stroke-width': 3 }), ...[0, 1, 2, 3, 4].map((k) => nodo('circle', { cx: (Math.cos(k * 1.2566) * 11).toFixed(1), cy: (Math.sin(k * 1.2566) * 11).toFixed(1), r: 4, fill: '#8A5A00' })))));
        break;
      case 'revisor':
        fondo.append(nodo('circle', { cx: 548, cy: 92, r: 24, fill: '#FFFFFF', stroke: '#5A5F67', 'stroke-width': 3 }));
        fondo.append(nodo('line', { class: 'fp-aguja', x1: 548, y1: 92, x2: 548, y2: 76, stroke: '#191C20', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
        fondo.append(nodo('line', { x1: 548, y1: 92, x2: 560, y2: 92, stroke: '#191C20', 'stroke-width': 3, 'stroke-linecap': 'round' }));
        mesa.append(R(262, 312, 56, 14, '#FFFFFF', { stroke: '#C9D7E6' }));
        mesa.append(nodo('g', { class: 'fp-sello' }, R(274, 282, 16, 18, '#8A5A00', { rx: 3 }), R(268, 298, 28, 8, '#5A3A00', { rx: 2 })));
        mesa.append(T(290, 324, 'OK', { class: 'fp-ok', 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: '#1E6B4E' }));
        mesa.append(nodo('g', { transform: 'translate(548 306)' }, nodo('g', { class: 'fp-lupa' }, nodo('circle', { r: 12, fill: '#FFFFFF', 'fill-opacity': 0.7, stroke: '#1D4F7A', 'stroke-width': 3.5 }), nodo('line', { x1: 9, y1: 9, x2: 19, y2: 19, stroke: '#1D4F7A', 'stroke-width': 4.5, 'stroke-linecap': 'round' }))));
        break;
      case 'publicador':
        fondo.append(nodo('g', { transform: 'translate(278 104)' }, nodo('g', { class: 'fp-cohete' }, nodo('path', { d: 'M0-30c10 8 12 24 6 40h-12c-6-16-4-32 6-40z', fill: '#FFFFFF', stroke: '#1D4F7A', 'stroke-width': 2.5 }), nodo('circle', { cy: -10, r: 4, fill: '#5A8BB5' }), nodo('path', { class: 'fp-llama', d: 'M-4 12q4 14 8 0z', fill: '#E8B84A' }))));
        mesa.append(R(520, 312, 58, 14, '#8A9099', { rx: 2 })); mesa.append(R(524, 306, 50, 8, '#FFFFFF', { stroke: '#C9D7E6' }));
        for (let k = 0; k < 3; k++) mesa.append(nodo('g', { transform: 'translate(548 300)' }, nodo('g', { class: 'fp-avion', style: `--k:${k}` }, poli([[-9, 3], [10, -4], [-1, 6]], '#FFFFFF', { stroke: '#1D4F7A', 'stroke-width': 1.2 }), poli([[-1, 6], [10, -4], [0, 2]], '#D3E4F5'))));
        break;
      case 'linkedin':
        fondo.append(nodo('g', { transform: 'translate(262 70)' }, R(0, 0, 40, 40, '#0A66C2', { rx: 7 }), R(8, 16, 6, 17, '#FFFFFF'), R(8, 7, 6, 6, '#FFFFFF'), R(18, 16, 6, 17, '#FFFFFF'), nodo('path', { d: 'M24 20q4-5 9-4 3 1 3 7v10h-6v-9q0-3-3-3t-3 3z', fill: '#FFFFFF' })));
        mesa.append(R(528, 296, 22, 32, '#2E3238', { rx: 4 })); mesa.append(R(531, 300, 16, 22, '#D3E4F5', { rx: 2 }));
        for (let k = 0; k < 3; k++) mesa.append(nodo('circle', { class: 'fp-noti', style: `--k:${k}`, cx: 548, cy: 296, r: 5, fill: '#B3261E' }));
        break;
      case 'vigilante':
        fondo.append(R(536, 30, 24, 10, '#5A5F67', { rx: 2 }));
        fondo.append(nodo('path', { class: 'fp-sirena', d: 'M538 30a10 10 0 0 1 20 0z', fill: '#E8B84A' }));
        fondo.append(nodo('g', { transform: 'translate(548 26)' }, nodo('path', { class: 'fp-giro', d: 'M0 0L90 -14L90 14z', fill: '#E8B84A', 'fill-opacity': 0.22 })));
        mesa.append(R(270, 300, 14, 26, '#2E3238', { rx: 3 })); mesa.append(R(275, 290, 3, 12, '#2E3238'));
        mesa.append(nodo('circle', { class: 'foco', cx: 277, cy: 306, r: 2.5, fill: '#5BC08A' }));
        mesa.append(R(536, 304, 20, 22, '#FFFFFF', { rx: 3, stroke: '#C9D7E6' }));
        break;
      default: // worker añadido desde el panel: su icono en un cuadro, libreta y planta
        fondo.append(R(254, 62, 56, 56, '#FFFFFF', { rx: 10, stroke: '#C9D7E6', 'stroke-width': 3 }));
        fondo.append(icoEn((w && w.icono) || 'chispa', 266, 74, 32, camisa(id)));
        fondo.append(R(524, 70, 50, 34, '#FFFFFF', { stroke: '#C9B79C', 'stroke-width': 4 }));
        mesa.append(R(262, 312, 50, 14, '#FFFFFF', { stroke: '#C9D7E6' }));
        mesa.append(R(538, 306, 22, 20, '#B5A285', { rx: 3 }));
        for (let k = 0; k < 3; k++) mesa.append(nodo('ellipse', { class: 'fp-hoja-planta', style: `--k:${k}`, cx: 549 + (k - 1) * 8, cy: 298 - (k === 1 ? 6 : 0), rx: 6, ry: 10, fill: C.verde }));
        break;
      case 'contable':
        mesa.append(nodo('g', {}, R(262, 290, 44, 36, '#3A3F46', { rx: 4 }), R(267, 294, 34, 9, '#D3E4F5', { rx: 1 }),
          ...Array.from({ length: 6 }, (_, k) => R(268 + (k % 3) * 11, 306 + Math.floor(k / 3) * 9, 8, 6, '#C9D7E6', { rx: 1, class: 'fp-tecla', style: `--k:${k}` }))));
        for (let k = 0; k < 4; k++) mesa.append(nodo('g', { class: 'fp-moneda', style: `--k:${k}` }, nodo('ellipse', { cx: 550, cy: 322 - k * 6, rx: 14, ry: 5, fill: '#8A5A00' }), nodo('ellipse', { cx: 550, cy: 320 - k * 6, rx: 14, ry: 5, fill: '#E8B84A' })));
        break;
    }
    return { fondo, mesa };
  }

  function personaFrente(id) {
    const g = nodo('g', { class: 'fp-persona' });
    g.append(nodo('path', { class: 'fp-torso', d: 'M368 340V297q0-28 28-28h38q28 0 28 28v43z', fill: camisa(id) }));
    g.append(R(405, 252, 20, 20, piel(id)));
    const cab = nodo('g', { class: 'fp-cabeza' });
    cab.append(nodo('circle', { cx: 415, cy: 236, r: 30, fill: piel(id) }));
    cab.append(nodo('path', { d: 'M384 236a31 31 0 0 1 62 0c-10-15-52-15-62 0z', fill: pelo(id) }));
    cab.append(nodo('g', { class: 'fp-ojos' }, nodo('ellipse', { cx: 404, cy: 240, rx: 3.2, ry: 4.2, fill: '#191C20' }), nodo('ellipse', { cx: 426, cy: 240, rx: 3.2, ry: 4.2, fill: '#191C20' })));
    cab.append(nodo('path', { class: 'fp-ojos-cerrados', d: 'M400 241h8M422 241h8', stroke: '#191C20', 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
    cab.append(nodo('path', { class: 'fp-boca', d: 'M407 252q8 6 16 0', fill: 'none', stroke: '#7A3E2B', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    cab.append(nodo('path', { class: 'fp-boca-mal', d: 'M407 255q8-5 16 0', fill: 'none', stroke: '#7A3E2B', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    if (id === 'voz') { // cascos
      cab.append(nodo('path', { d: 'M382 236a33 33 0 0 1 66 0', fill: 'none', stroke: '#2E3238', 'stroke-width': 6 }));
      cab.append(R(377, 226, 11, 24, '#2E3238', { rx: 5 })); cab.append(R(442, 226, 11, 24, '#2E3238', { rx: 5 }));
    }
    g.append(cab);
    return g;
  }
  function brazos(id) {
    const g = nodo('g', { class: 'fp-brazos' });
    const brazo = (d, mx, my, cls) => nodo('g', { class: cls }, nodo('path', { d, fill: 'none', stroke: camisa(id), 'stroke-width': 17, 'stroke-linecap': 'round' }), nodo('circle', { class: 'fp-mano', cx: mx, cy: my, r: 9, fill: piel(id) }));
    g.append(brazo('M380 292q-26 18-20 38', 362, 330, 'fp-brazo fp-izq'));
    g.append(brazo('M450 292q26 18 20 38', 468, 330, 'fp-brazo fp-der'));
    g.append(brazo('M452 290q30-14 26-56', 478, 228, 'fp-brazo-arriba'));
    if (id === 'voz') { // micro con antipop delante, a un lado
      g.append(nodo('path', { d: 'M520 326V292q0-22-40-36', fill: 'none', stroke: '#5A5F67', 'stroke-width': 4 }));
      g.append(R(458, 238, 14, 26, '#2E3238', { rx: 7 }));
      g.append(nodo('circle', { cx: 448, cy: 250, r: 13, fill: '#FFFFFF', 'fill-opacity': 0.35, stroke: '#8A9099', 'stroke-width': 1.5 }));
      for (let k = 0; k < 3; k++) g.append(nodo('path', { class: 'fp-onda', style: `--k:${k}`, d: 'M480 236q10 14 0 28', fill: 'none', stroke: '#1E6B4E', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    }
    return g;
  }

  // Sala de Ada vista de frente: su cara en la pantalla grande y la consola
  function adaFrente() {
    const g = nodo('g', { class: 'fp-ada' });
    for (let k = 0; k < 3; k++) g.append(nodo('circle', { class: 'fp-onda-ada', style: `--k:${k}`, cx: 415, cy: 132, r: 150, fill: 'none', stroke: '#5A8BB5', 'stroke-width': 2 }));
    g.append(R(270, 34, 290, 196, '#2E3238', { rx: 12 }));
    g.append(R(280, 44, 270, 176, '#1D4F7A', { rx: 6 }));
    g.append(nodo('g', { class: 'fp-ojos' }, R(360, 90, 22, 54, '#FFFFFF', { rx: 11 }), R(448, 90, 22, 54, '#FFFFFF', { rx: 11 })));
    g.append(nodo('path', { class: 'fp-boca', d: 'M370 172q45 30 90 0', fill: 'none', stroke: '#FFFFFF', 'stroke-width': 8, 'stroke-linecap': 'round' }));
    g.append(nodo('path', { class: 'fp-boca-mal', d: 'M375 186q40-24 80 0', fill: 'none', stroke: '#FFFFFF', 'stroke-width': 8, 'stroke-linecap': 'round' }));
    g.append(R(405, 230, 20, 60, '#3A3F46'));
    return g;
  }

  let frenteEl = null, frenteId = null, tFrente = 0;
  // «Muestra»: el worker te enseña en su pantalla lo que ha hecho (el panel pone el contenido)
  let muestra = null, muestraId = null;
  function quitarFrente() {
    clearTimeout(tFrente); tFrente = 0;
    if (frenteEl) frenteEl.remove();
    frenteEl = null; frenteId = null; muestra = null; muestraId = null;
    if (raiz) raiz.classList.remove('de-frente', 'estrecho');
  }
  function ponerFrente(id) {
    if (!raiz || ultimoElegido !== id) return;
    if (frenteEl) frenteEl.remove();
    const estrecho = raiz.clientWidth < 560, alto = estrecho ? FH_ESTRECHO : FH;
    raiz.classList.add('de-frente'); raiz.classList.toggle('estrecho', estrecho);
    const caja = document.createElement('div'); caja.className = 'frente';
    const s = nodo('svg', { class: 'frente-svg', viewBox: `0 0 ${FW} ${alto}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' });
    const w = ultimosDatos && (id === 'ada' ? null : ultimosDatos.trabajadores.find((x) => x.id === id));
    s.setAttribute('aria-label', id === 'ada' ? 'Ada en su sala, vista de frente, con sus herramientas' : `${w ? w.nombre : id} en su puesto, visto de frente, con sus herramientas`);
    // pared y suelo; en pantallas estrechas la escena se agranda y las herramientas van debajo
    const marco = nodo('g', { class: 'fp-marco', transform: estrecho ? 'translate(415 0) scale(1.55) translate(-415 -24)' : null });
    s.append(marco);
    marco.append(R(-300, -100, FW + 600, 460, '#E9EFF6'), R(-300, 352, FW + 600, 8, '#DCE3EB'), R(-300, 360, FW + 600, 500, '#DCE5EF'));
    for (let k = 1; k < 9; k++) marco.append(nodo('line', { x1: k * 95, y1: 360, x2: k * 95 + (k * 95 - 415) * 0.5, y2: 515, stroke: '#C9D7E6', 'stroke-width': 1 }));
    marco.append(nodo('line', { x1: -300, y1: 430, x2: FW + 300, y2: 430, stroke: '#C9D7E6', 'stroke-width': 1 }));
    const cosas = nodo('g', { class: 'fp-escena' });
    if (id === 'ada') {
      cosas.append(adaFrente());
      cosas.append(nodo('ellipse', { cx: 415, cy: 446, rx: 200, ry: 14, fill: '#C9D7E6' }));
      cosas.append(R(240, 290, 350, 18, '#FFFFFF', { rx: 4 }), R(250, 308, 330, 130, '#E6EBF2'), R(250, 308, 330, 6, '#D3DEEA'));
      for (let k = 0; k < 8; k++) cosas.append(nodo('circle', { class: 'led', style: `--i:${k}`, cx: 290 + k * 36, cy: 340, r: 5 }));
      cosas.append(nodo('circle', { class: 'baliza fp-baliza', cx: 415, cy: 380, r: 9 }));
    } else {
      const { fondo, mesa } = decorado(id, w);
      cosas.append(fondo);
      // pantalla grande en la pared con lo que hace
      cosas.append(R(310, 44, 210, 140, '#2E3238', { rx: 8 }));
      cosas.append(R(318, 52, 194, 124, '#1D4F7A', { class: 'fp-fondo-pantalla', rx: 4 }));
      cosas.append(contenidoPantalla((w && w.pantalla && w.pantalla !== 'texto' ? w.pantalla : id), 318, 52, 194, 124));
      cosas.append(T(415, 122, '!', { class: 'fp-aviso-pantalla', 'text-anchor': 'middle', 'font-size': 64, 'font-weight': 800, fill: '#FFFFFF' }));
      cosas.append(R(406, 184, 18, 10, '#5A5F67'));
      for (let k = 0; k < 3; k++) cosas.append(nodo('circle', { class: 'fp-humo', style: `--k:${k}`, cx: 470, cy: 50, r: 10, fill: '#9AA3AD' }));
      cosas.append(personaFrente(id));
      // mesa
      cosas.append(nodo('ellipse', { cx: 415, cy: 448, rx: 190, ry: 12, fill: '#C9D7E6' }));
      cosas.append(R(240, 326, 350, 14, '#E2D4BD', { rx: 3 }), R(252, 340, 326, 100, '#C9B79C'), R(252, 340, 326, 6, '#B5A285'));
      cosas.append(R(368, 318, 94, 9, '#3A3F46', { rx: 3 }));
      cosas.append(mesa);
      cosas.append(brazos(id));
      cosas.append(nodo('g', { class: 'fp-mano-alzada' }, R(488, 196, 22, 26, '#FBEFD3', { rx: 6, stroke: '#8A5A00', 'stroke-width': 1.5 }), T(499, 215, '!', { 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, fill: '#8A5A00' })));
      const zz = nodo('g', { class: 'fp-zz' }); for (let k = 0; k < 3; k++) zz.append(T(455 + k * 14, 214 - k * 14, 'z', { style: `--k:${k}`, 'font-size': 16 + k * 4, 'font-weight': 800, fill: '#8A9099' })); cosas.append(zz);
    }
    marco.append(cosas);
    // la frase de lo que está haciendo, en el suelo
    const pie = nodo('g', { class: 'fp-pie' }, R(235, 462, 360, 34, '#FFFFFF', { rx: 17, stroke: '#DCE3EB' }), nodo('circle', { class: 'fp-punto', cx: 257, cy: 479, r: 5 }), T(270, 484, '', { class: 'fp-frase', 'font-size': 14, 'font-weight': 600, fill: '#191C20' }));
    marco.append(pie);
    // herramientas que salen de la mesa hacia su sitio
    const lista = (w && w.herramientas && w.herramientas.length ? w.herramientas : HERRAMIENTAS[id]) || [];
    const sitios = estrecho
      ? lista.map((_, i) => ({ x: 22 + (i % 2) * 400, y: 785 + Math.floor(i / 2) * 170, k: 1.75 }))
      : lista.map((_, i) => ({ x: i % 2 ? 594 : 16, y: i < 2 ? 70 : 214, k: 1 }));
    s.append(T(estrecho ? 22 : 16, estrecho ? 768 : 54, lista.length ? 'Sus herramientas' : 'Aún sin herramientas: se añaden en «Editar»', { class: 'fp-titulo', 'font-size': estrecho ? 24 : 13, 'font-weight': 700, fill: '#5A5F67' }));
    const origen = [415, id === 'ada' ? 300 : 326];
    lista.forEach((h, i) => {
      const st = sitios[i], cw = 220, ch = 86, cx = st.x + (cw * st.k) / 2, cy = st.y + (ch * st.k) / 2;
      if (!estrecho) {
        const bordeX = i % 2 ? st.x : st.x + cw, bordeY = st.y + ch / 2, finX = i % 2 ? 560 : 270;
        marco.insertBefore(nodo('path', { class: 'fp-cable', style: `--i:${i}`, d: `M${bordeX} ${bordeY}C${(bordeX + finX) / 2} ${bordeY} ${finX} ${(bordeY + origen[1]) / 2} ${finX} ${origen[1]}`, fill: 'none', stroke: h.c, 'stroke-width': 2, 'stroke-dasharray': '5 7' }), cosas);
      }
      const dx = (origen[0] - cx) / st.k, dy = (origen[1] - cy) / st.k;
      const tarjeta = nodo('g', { class: 'fp-herramienta', style: `--i:${i};--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px` },
        nodo('g', { class: 'fp-flota', style: `--i:${i}` },
          R(0, 0, cw, ch, '#FFFFFF', { rx: 14, stroke: '#DCE3EB', 'stroke-width': 1.5 }),
          R(0, 0, 5, ch, h.c, { rx: 2.5 }),
          R(14, 18, 46, 46, '#F3F6FA', { rx: 11 }),
          icoEn(h.ic, 24, 28, 26, h.c),
          T(72, 36, h.n, { 'font-size': 14.5, 'font-weight': 700, fill: '#191C20' }),
          ...partir(h.d, 24).map((l, k) => T(72, 55 + k * 15, l, { 'font-size': 12, fill: '#5A5F67' }))));
      s.append(nodo('g', { transform: `translate(${st.x} ${st.y}) scale(${st.k})` }, tarjeta));
    });
    caja.append(s);
    raiz.insertBefore(caja, capaCarteles);
    frenteEl = caja; frenteId = id;
    if (muestra && muestraId === id) caja.append(muestra);
    actualizarFrente();
  }
  // El worker gira su pantalla hacia ti con lo que ha hecho. contenido: un nodo HTML que pone el panel.
  function mostrar(id, contenido) {
    ocultarMuestra(true);
    muestra = document.createElement('div'); muestra.className = 'muestra';
    muestra.setAttribute('role', 'dialog'); muestra.setAttribute('aria-label', 'Lo que te enseña el worker');
    muestra.append(contenido); muestraId = id;
    if (frenteEl && frenteId === id) { frenteEl.append(muestra); actualizarFrente(); }
    return muestra;
  }
  function ocultarMuestra(ya) {
    const m = muestra; muestra = null; muestraId = null;
    if (!m) return;
    if (ya || quieto) m.remove(); else { m.classList.add('se-va'); setTimeout(() => m.remove(), 420); }
    actualizarFrente();
  }
  function actualizarFrente() {
    if (!frenteEl) return;
    const id = frenteId;
    const est = id === 'ada' ? (ultimosDatos ? ultimosDatos.ada.estado : 'ok') : estadoDe(id);
    frenteEl.className = 'frente ' + est + (muestra && muestraId === id ? ' enseña' : '');
    const w = ultimosDatos && ultimosDatos.trabajadores.find((x) => x.id === id);
    const frase = forzados[id + ':frase'] || (w && w.frase) || (id === 'ada' && ultimosDatos && ultimosDatos.ada.frase) || '';
    const txt = (ESTADO_TXT[est] || '') + (frase ? ' · ' + frase : '');
    const t = frenteEl.querySelector('.fp-frase');
    const corto = txt.length > 44 ? txt.slice(0, 43) + '…' : txt;
    if (t && t.textContent !== corto) t.textContent = corto;
  }

  window.MundoAda = { montar, desmontar, pintar, campana, icono, mostrar, ocultarMuestra, triturar, ESTADO_TXT, HERRAMIENTAS };
})();
