// Azar con semilla: la misma semilla da siempre la misma simulación (para pruebas y para comparar escenarios).
// Sin dependencias; funciona en el navegador.

export function crearAzar(semilla = 1) {
  let s = (semilla >>> 0) || 1;
  const u = () => { // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const az = {
    u,
    entre: (a, b) => a + (b - a) * u(),
    entero: (a, b) => Math.floor(a + (b - a + 1) * u()),
    si: (p) => u() < p,
    normal(m = 0, d = 1) { let x = 0; while (x === 0) x = u(); return m + d * Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * u()); },
    /** Tiempos de personas: casi nunca negativos y con cola larga (a veces se tarda mucho más). */
    lognormal(mediana, sigma) { return mediana * Math.exp(sigma * az.normal()); },
    triangular(a, m, b) {
      const x = u(), c = (m - a) / (b - a || 1);
      return x < c ? a + Math.sqrt(x * (b - a) * (m - a)) : b - Math.sqrt((1 - x) * (b - a) * (b - m));
    },
    poisson(l) {
      if (l <= 0) return 0;
      if (l > 50) return Math.max(0, Math.round(az.normal(l, Math.sqrt(l))));
      const L = Math.exp(-l); let k = 0, p = 1;
      do { k += 1; p *= u(); } while (p > L);
      return k - 1;
    },
    elegir(lista) { return lista[Math.floor(u() * lista.length)]; },
    /** pesos: { a: 0.4, b: 0.6 } → 'a' o 'b' */
    segun(pesos) {
      const e = Object.entries(pesos); const tot = e.reduce((s, [, p]) => s + p, 0);
      let x = u() * tot;
      for (const [k, p] of e) { x -= p; if (x <= 0) return k; }
      return e[e.length - 1][0];
    },
    /**
     * Un valor de una variable del modelo. Acepta: número | { fijo } | { min, probable, max } (triangular)
     * | { mediana, sigma } (lognormal) | { media } (Poisson). Lo demás que traiga (fuente, fecha, nota) se ignora.
     */
    valor(v) {
      if (typeof v === 'number') return v;
      if (v == null) return v;
      if ('fijo' in v) return v.fijo;
      if ('min' in v && 'max' in v) return az.triangular(v.min, v.probable ?? (v.min + v.max) / 2, v.max);
      if ('mediana' in v) return az.lognormal(v.mediana, v.sigma ?? 0.5);
      if ('media' in v) return az.poisson(v.media);
      throw new Error(`No sé muestrear ${JSON.stringify(v)}`);
    },
  };
  return az;
}

/** Valor «probable» de una variable (sin azar), para enseñarla. */
export function probable(v) {
  if (typeof v === 'number' || v == null) return v;
  if ('fijo' in v) return v.fijo;
  if ('probable' in v) return v.probable;
  if ('min' in v) return (v.min + v.max) / 2;
  if ('mediana' in v) return v.mediana;
  if ('media' in v) return v.media;
  return null;
}
