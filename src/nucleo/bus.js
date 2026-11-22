// El pasillo entre oficinas: una oficina publica («pedidos.registrado») y las que escuchan lo reciben.
// En memoria. En el servidor, cada evento se guarda antes de repartirlo (ver node/bus-fichero.js cuando haga falta).
// reloj: () => ms. El mismo que el de las oficinas, para que en el laboratorio y en el modo simulación
// los eventos lleven la hora simulada y no la del ordenador.
export function crearBus({ reloj = () => Date.now(), maximo = 500 } = {}) {
  const oyentes = new Map();
  const registro = [];
  const pendientes = new Set();
  return {
    escuchar(evento, f) {
      if (!oyentes.has(evento)) oyentes.set(evento, new Set());
      oyentes.get(evento).add(f);
      return () => oyentes.get(evento).delete(f);
    },
    publicar(evento, datos) {
      registro.push({ evento, fecha: new Date(reloj()).toISOString(), datos });
      if (registro.length > maximo) registro.shift();
      for (const patron of [evento, '*']) {
        for (const f of oyentes.get(patron) || []) {
          const p = Promise.resolve().then(() => f(datos, evento)).catch(() => {});
          pendientes.add(p);
          p.finally(() => pendientes.delete(p));
        }
      }
    },
    /** Espera a que se hayan repartido todos los eventos (también los que generan otros eventos). */
    async calma() {
      while (pendientes.size) await Promise.all([...pendientes]);
    },
    ultimos: (n = 50) => registro.slice(-n),
    todos: () => registro.slice(),
  };
}
