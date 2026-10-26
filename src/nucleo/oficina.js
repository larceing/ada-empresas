// Ada base: una oficina con puestos. Funciona igual en el servidor (Node) y en el navegador (laboratorio):
// no usa nada de Node; lo que depende del sitio (leer PDF, IA, guardar, mandar al ERP) llega como «herramientas».
//
// Cómo trabaja una oficina:
//   Recepción    recibe lo que entra, lo lee y decide si le toca a esta oficina (si no, lo aparta).
//   Gestión      saca los datos y los comprueba contra lo que la oficina ya sabe (clientes, catálogo…).
//   Supervisión  una persona aprueba, corrige o descarta lo dudoso. Lo limpio pasa solo si hay piloto automático.
//   Registro     lo lleva al sistema de destino (el ERP, una hoja…) y avisa a las demás oficinas.
//   Seguimiento  lleva los estados posteriores (confirmado, servido…) y vigila lo atascado.
//   Incidencias  cualquier fallo en un puesto acaba aquí con su tipo y se puede reintentar desde ese puesto.

export const PUESTOS = [
  { id: 'recepcion', nombre: 'Recepción', quien: 'regla' },
  { id: 'gestion', nombre: 'Gestión', quien: 'regla+ia' },
  { id: 'supervision', nombre: 'Supervisión', quien: 'persona' },
  { id: 'registro', nombre: 'Registro', quien: 'regla' },
  { id: 'seguimiento', nombre: 'Seguimiento', quien: 'persona' },
  { id: 'incidencias', nombre: 'Incidencias', quien: 'persona' },
];
const ORDEN = ['recepcion', 'gestion', 'supervision', 'registro'];

export const ESTADOS = {
  en_curso: 'En curso',
  por_revisar: 'Por revisar',
  registrado: 'Registrado',
  no_corresponde: 'No es de esta oficina',
  descartado: 'Descartado',
  incidencia: 'Incidencia',
};

class Fallo extends Error {
  constructor(codigo, mensaje) { super(mensaje); this.codigo = codigo; }
}
export { Fallo };

const ahoraIso = (reloj) => new Date(reloj()).toISOString();

/**
 * @param {object} o
 * @param {string} o.id           p. ej. 'pedidos'
 * @param {string} o.nombre       p. ej. 'Pedidos'
 * @param {object} o.plantilla    qué es un caso en esta oficina (ver plantillas/)
 * @param {object} o.almacen      dónde se guarda (memoria.js o node/almacen.js)
 * @param {object} [o.herramientas] { leerAdjunto, ia, destinos: { nombre: { registrar } } }
 * @param {object} [o.bus]        para pasarse trabajo entre oficinas (bus.js)
 * @param {object} [o.puestos]    nombres propios por puesto: { recepcion: { nombre, persona } }
 * @param {Function} [o.reloj]    () => ms; se cambia en pruebas y en el laboratorio
 */
export function crearOficina(o) {
  const { id, nombre, plantilla, almacen } = o;
  const h = { destinos: {}, ...(o.herramientas || {}) };
  const bus = o.bus || null;
  const reloj = o.reloj || (() => Date.now());
  const puestos = PUESTOS.map((p) => ({ ...p, ...(plantilla.puestos || {})[p.id], ...(o.puestos || {})[p.id] }));
  const nombrePuesto = (pid) => (puestos.find((p) => p.id === pid) || {}).nombre || pid;
  const oyentes = new Set();

  function anotar(exp, puesto, que, detalle, quien) {
    exp.historial.push({ fecha: ahoraIso(reloj), puesto, quien: quien || nombrePuesto(puesto), que, ...(detalle ? { detalle } : {}) });
  }

  async function guardar(exp) {
    exp.actualizado = ahoraIso(reloj);
    await almacen.guardar(exp);
    for (const f of oyentes) { try { f(exp); } catch { /* un oyente roto no para la oficina */ } }
    return exp;
  }

  async function ctx(exp) {
    const config = await almacen.config();
    return {
      config, exp, reloj,
      equivalencia: (cliente, ref) => almacen.equivalencia(cliente, ref),
      aprender: (cliente, ref, valor) => almacen.aprender(cliente, ref, valor),
      existe: (filtro) => almacen.existe(filtro),
    };
  }

  // ---------- los puestos ----------
  const trabajo = {
    async recepcion(exp) {
      // Leer adjuntos que aún no tienen texto (PDF, Excel…). Gratis: se hace en el sitio.
      for (const a of exp.entrada.adjuntos || []) {
        if (a.texto === undefined && h.leerAdjunto) {
          const r = await h.leerAdjunto(a);
          a.texto = r.texto || '';
          a.metodo = r.metodo;
          if (r.aviso) a.aviso = r.aviso;
        }
        delete a.datos; // el binario no se guarda en el expediente
      }
      const c = await ctx(exp);
      exp.cliente = plantilla.identificar ? await plantilla.identificar(exp.entrada, c) : null;
      const clase = plantilla.clasificar(exp.entrada, c);
      exp.clase = clase;
      anotar(exp, 'recepcion', clase.es === false ? 'apartado' : 'recibido', clase.motivo);
      if (clase.es === false) return { parar: 'no_corresponde' };
      return { siguiente: 'gestion' };
    },

    async gestion(exp) {
      const c = await ctx(exp);
      let datos = plantilla.extraer(exp.entrada, c);
      let metodo = 'reglas';
      const flojo = exp.clase.es === 'duda' || (plantilla.flojo ? plantilla.flojo(datos) : false);
      if (flojo && h.ia && plantilla.esquema) {
        const r = await h.ia.extraer({ plantilla, entrada: exp.entrada });
        if (r.ok) {
          exp.ia = r.uso || null;
          if (r.datos && r.datos.no_corresponde && exp.clase.es === 'duda') {
            anotar(exp, 'gestion', 'apartado', 'La IA dice que no es de esta oficina', 'IA');
            return { parar: 'no_corresponde' };
          }
          datos = plantilla.unir ? plantilla.unir(datos, r.datos) : r.datos;
          metodo = 'reglas+ia';
          if (exp.clase.es === 'duda') exp.clase = { ...exp.clase, es: true };
        } else {
          anotar(exp, 'gestion', 'sin IA', r.motivo, 'IA');
        }
      }
      const v = await plantilla.validar(datos, c);
      exp.datos = v.datos;
      exp.avisos = v.avisos;
      if (exp.clase.es === 'duda') exp.avisos.push({ tipo: 'clase', texto: 'No está claro que sea de esta oficina' });
      for (const a of exp.entrada.adjuntos || []) if (a.aviso) exp.avisos.push({ tipo: 'lectura', texto: `${a.nombre}: ${a.aviso}` });
      anotar(exp, 'gestion', 'extraído', `${plantilla.resumir ? plantilla.resumir(exp.datos) : ''} (${metodo})${exp.avisos.length ? ` · ${exp.avisos.length} avisos` : ''}`);
      return { siguiente: 'supervision' };
    },

    async supervision(exp) {
      const config = await almacen.config();
      const auto = config.automatico === true || (exp.cliente && (config.automatico || []).includes(exp.cliente.id));
      if (!exp.avisos.length && auto) {
        anotar(exp, 'supervision', 'pasa solo', 'Piloto automático para este cliente');
        return { siguiente: 'registro' };
      }
      anotar(exp, 'supervision', 'espera', exp.avisos.length ? exp.avisos.map((a) => a.texto).join(' · ') : 'Sin avisos; falta el OK');
      return { parar: 'por_revisar' };
    },

    async registro(exp) {
      const config = await almacen.config();
      const nombreDestino = config.destino || 'interno';
      const destino = h.destinos[nombreDestino];
      let resultado = { referencia: exp.id.slice(0, 8) };
      if (destino) resultado = await destino.registrar(exp, plantilla);
      else if (nombreDestino !== 'interno') throw Object.assign(new Error(`No hay destino «${nombreDestino}»`), { tipo: 'destino' });
      exp.registro = { destino: nombreDestino, ...resultado, fecha: ahoraIso(reloj) };
      exp.seguimiento = null;
      anotar(exp, 'registro', 'registrado', `En ${nombreDestino}${resultado.referencia ? ` · ${resultado.referencia}` : ''}`);
      return { parar: 'registrado', avisar: true };
    },
  };

  async function avanzar(exp, desde) {
    let puesto = desde;
    while (puesto) {
      exp.puesto = puesto;
      let r;
      try {
        r = await trabajo[puesto](exp);
      } catch (e) {
        exp.estado = 'incidencia';
        exp.puesto = 'incidencias';
        exp.incidencia = { puesto, tipo: e.tipo || 'error', mensaje: e.message, fecha: ahoraIso(reloj) };
        anotar(exp, 'incidencias', 'incidencia', `${nombrePuesto(puesto)}: ${e.message}`);
        await guardar(exp);
        if (bus) bus.publicar(`${id}.incidencia`, resumen(exp));
        return exp;
      }
      if (r.parar) {
        exp.estado = r.parar;
        exp.puesto = r.parar === 'registrado' ? 'seguimiento' : r.parar === 'por_revisar' ? 'supervision' : puesto;
        await guardar(exp);
        if (r.avisar && bus) bus.publicar(`${id}.registrado`, { ...resumen(exp), datos: exp.datos, cliente: exp.cliente });
        if (r.parar === 'por_revisar' && bus) bus.publicar(`${id}.por_revisar`, resumen(exp));
        return exp;
      }
      await guardar(exp);
      puesto = r.siguiente;
    }
    return exp;
  }

  function resumen(exp) {
    return {
      oficina: id, id: exp.id, estado: exp.estado, puesto: exp.puesto,
      cliente: exp.cliente ? exp.cliente.nombre : null,
      titulo: plantilla.titulo ? plantilla.titulo(exp) : exp.entrada.asunto || exp.id,
      avisos: (exp.avisos || []).map((a) => a.texto),
    };
  }

  // ---------- lo que se puede hacer desde fuera ----------
  const oficina = {
    id, nombre, plantilla, puestos, almacen,

    /** Entra un caso nuevo. entrada: { canal, de, de_nombre, para, asunto, texto, adjuntos: [{ nombre, tipo, datos?|texto? }] } */
    async entrar(entrada, { clave } = {}) {
      if (clave && await almacen.visto(clave)) return { omitido: true, motivo: 'Ya había entrado', clave };
      const exp = {
        id: almacen.nuevoId(), oficina: id, tipo: plantilla.nombre, estado: 'en_curso', puesto: 'recepcion',
        recibido: ahoraIso(reloj), clave: clave || null,
        entrada: { ...entrada, adjuntos: (entrada.adjuntos || []).map((a) => ({ ...a })) },
        cliente: null, clase: null, datos: null, avisos: [], ia: null, historial: [],
      };
      anotar(exp, 'recepcion', 'entra', [entrada.canal, entrada.de].filter(Boolean).join(' · '));
      return avanzar(exp, 'recepcion');
    },

    /** Supervisión: aprobar con correcciones (lo corregido se aprende). */
    async aprobar(expId, cambios = {}, quien = 'Supervisión') {
      const exp = await obtener(expId);
      if (exp.estado !== 'por_revisar') throw new Fallo(409, `Está en «${ESTADOS[exp.estado] || exp.estado}»: solo se aprueba lo que está por revisar`);
      const c = await ctx(exp);
      if (cambios.cliente_id) {
        const cl = (c.config.clientes || []).find((x) => x.id === cambios.cliente_id);
        if (!cl) throw new Fallo(400, 'Cliente desconocido');
        exp.cliente = { id: cl.id, nombre: cl.nombre };
        c.exp = exp;
      }
      const corregido = plantilla.corregir ? await plantilla.corregir(exp, cambios, c) : { datos: exp.datos };
      const v = await plantilla.validar(corregido.datos, c, { aceptados: corregido.aceptados || [] });
      exp.datos = v.datos;
      exp.avisos = v.avisos;
      if (exp.avisos.length) {
        anotar(exp, 'supervision', 'corregido', `Quedan ${exp.avisos.length} avisos`, quien);
        return guardar(exp);
      }
      anotar(exp, 'supervision', 'aprobado', null, quien);
      return avanzar(exp, 'registro');
    },

    async descartar(expId, motivo = '', quien = 'Supervisión') {
      const exp = await obtener(expId);
      if (!['por_revisar', 'no_corresponde', 'incidencia'].includes(exp.estado)) throw new Fallo(409, 'Solo se descarta lo que no está registrado');
      exp.estado = 'descartado';
      anotar(exp, exp.puesto, 'descartado', motivo || null, quien);
      return guardar(exp);
    },

    /** Recuperar algo apartado o descartado: vuelve a Supervisión. */
    async recuperar(expId, quien = 'Supervisión') {
      const exp = await obtener(expId);
      if (!['descartado', 'no_corresponde'].includes(exp.estado)) throw new Fallo(409, 'Solo se recupera lo apartado o descartado');
      if (!exp.datos) { anotar(exp, 'supervision', 'recuperado', 'Se vuelve a leer', quien); exp.clase = { es: true, motivo: 'Recuperado a mano' }; return avanzar(exp, 'gestion'); }
      exp.estado = 'por_revisar';
      exp.puesto = 'supervision';
      anotar(exp, 'supervision', 'recuperado', null, quien);
      return guardar(exp);
    },

    /** Incidencias: volver a intentar desde el puesto que falló. */
    async reintentar(expId, quien = 'Incidencias') {
      const exp = await obtener(expId);
      if (exp.estado !== 'incidencia') throw new Fallo(409, 'No tiene incidencia');
      const desde = exp.incidencia.puesto;
      anotar(exp, 'incidencias', 'reintento', nombrePuesto(desde), quien);
      exp.incidencia = null;
      exp.estado = 'en_curso';
      return avanzar(exp, desde);
    },

    /** Seguimiento: estados después de registrar (los define la plantilla, en orden). */
    async seguir(expId, estado, quien = 'Seguimiento') {
      const exp = await obtener(expId);
      const pasos = plantilla.estadosSeguimiento || [];
      if (exp.estado !== 'registrado') throw new Fallo(409, 'Solo se sigue lo registrado');
      const actual = exp.seguimiento ? pasos.indexOf(exp.seguimiento) : -1;
      if (pasos.indexOf(estado) !== actual + 1) throw new Fallo(409, `El siguiente paso es «${pasos[actual + 1] || 'ninguno'}»`);
      exp.seguimiento = estado;
      anotar(exp, 'seguimiento', estado, null, quien);
      await guardar(exp);
      if (bus) bus.publicar(`${id}.${estado}`, resumen(exp));
      return exp;
    },

    /** Lo que lleva más de N horas esperando en Supervisión o con incidencia. */
    async atascados(horas = 4) {
      const lim = reloj() - horas * 3600e3;
      return (await almacen.listar()).filter((e) => ['por_revisar', 'incidencia'].includes(e.estado) && Date.parse(e.actualizado || e.recibido) < lim);
    },

    /** Cuántos casos hay en cada puesto y estado (para el panel y la oficina 3D). */
    async tablero() {
      const todos = await almacen.listar();
      const t = { total: todos.length, por_estado: {}, por_puesto: {} };
      for (const e of todos) {
        t.por_estado[e.estado] = (t.por_estado[e.estado] || 0) + 1;
        t.por_puesto[e.puesto] = (t.por_puesto[e.puesto] || 0) + 1;
      }
      return t;
    },

    listar: () => almacen.listar(),
    obtener: (expId) => obtener(expId),
    resumen,
    alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },
  };

  async function obtener(expId) {
    const exp = await almacen.obtener(expId);
    if (!exp) throw new Fallo(404, 'No existe');
    return exp;
  }

  // Trabajo que llega de otras oficinas (p. ej. Producción escucha «pedidos.registrado»).
  if (bus && plantilla.escucha) {
    for (const evento of [].concat(plantilla.escucha)) {
      bus.escuchar(evento, async (datos) => {
        const entrada = plantilla.desdeEvento(evento, datos);
        if (entrada) await oficina.entrar(entrada, { clave: `${evento}:${datos.id}` });
      });
    }
  }

  return oficina;
}
