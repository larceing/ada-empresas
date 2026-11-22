// Montecarlo: repetir la simulación muchas veces con semillas distintas (cada vez salen otros pedidos,
// otras ausencias, otros tiempos) y dar el rango de resultados: P10 (año malo), P50 (típico), P90 (año bueno).
import { simular } from './motor.js';
import { percentil } from '../nucleo/metricas.js';

const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
export const rango = (v) => ({ p10: r1(percentil(v, 0.1)), p50: r1(percentil(v, 0.5)), p90: r1(percentil(v, 0.9)) });

/**
 * Compara escenarios (por defecto «manual» frente a «ada») con las mismas semillas, para que la diferencia sea justa.
 * @returns {{ replicas, escenarios: { [nombre]: { horas_persona_mes, error_lineas_pct, espera_p90_horas, ... } }, ahorro }}
 */
export async function montecarlo({ espacio, modelo = {}, replicas = 20, semilla = 1, dias = 365, escenarios = ['manual', 'ada'], alAvanzar = () => {} }) {
  const res = Object.fromEntries(escenarios.map((e) => [e, []]));
  for (let i = 0; i < replicas; i++) {
    for (const e of escenarios) {
      const r = await simular({ espacio, modelo, escenario: e, semilla: semilla + i, dias });
      delete r.expedientes;
      res[e].push(r);
    }
    alAvanzar(i + 1, replicas);
  }
  const resumen = {};
  for (const [e, v] of Object.entries(res)) {
    resumen[e] = {
      pedidos_ano: rango(v.map((x) => x.pedidos)),
      horas_persona_mes: rango(v.map((x) => x.horas_persona_mes)),
      horas_mes_pico: rango(v.map((x) => x.horas_mes_pico)),
      error_lineas_pct: rango(v.map((x) => x.error_lineas_pct)),
      espera_p90_horas: rango(v.map((x) => x.espera_horas.p90)),
      cola_max: rango(v.map((x) => x.cola_max)),
      ...(v[0].metricas ? { sin_tocar_pct: rango(v.map((x) => x.metricas.sin_tocar_pct)), clientes_en_piloto: rango(v.map((x) => x.clientes_en_piloto)) } : {}),
    };
  }
  let ahorro = null;
  if (res.manual && res.ada) {
    const coste = (modelo.personas && modelo.personas.coste_hora_eur) || 0;
    const horas = res.manual.map((m, i) => m.horas_persona_ano - res.ada[i].horas_persona_ano);
    const errores = res.manual.map((m, i) => m.errores_lineas - res.ada[i].errores_lineas);
    ahorro = {
      horas_ano: rango(horas),
      horas_mes: rango(horas.map((h) => h / 12)),
      errores_evitados_ano: rango(errores),
      ...(coste ? { euros_ano: rango(horas.map((h) => h * coste)) } : {}),
      replicas_con_ahorro_pct: Math.round((horas.filter((h) => h > 0).length / horas.length) * 1000) / 10,
    };
  }
  return { replicas, dias, escenarios: resumen, ahorro, crudo: res };
}
