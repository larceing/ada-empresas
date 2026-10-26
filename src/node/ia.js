// IA de texto (API de OpenAI: solo texto, nunca imágenes). La oficina solo la llama cuando las reglas no bastan.
// Cada espacio tiene tope de gasto al mes; pasado el tope, el caso va a Supervisión sin IA.
const MAX_CARACTERES = 12000;

export function crearIA({ almacen, clave = process.env.OPENAI_API_KEY, modelo = process.env.ADA_IA_MODELO || 'gpt-5.4-mini', fetchFn = fetch,
  // USD por millón de tokens, puestos a mano con el precio vigente. Sin ellos se cuentan tokens, no dinero.
  precioEntrada = Number(process.env.ADA_IA_PRECIO_ENTRADA || 0), precioSalida = Number(process.env.ADA_IA_PRECIO_SALIDA || 0) } = {}) {
  if (!clave) return null;
  return {
    async extraer({ plantilla, entrada }) {
      const tope = Number((await almacen.config()).tope_ia_usd || 0);
      if (tope > 0 && (await almacen.gastoMes()) >= tope) return { ok: false, motivo: `Tope de IA del mes alcanzado (${tope} $)` };
      const contenido = [
        `De: ${entrada.de_nombre || ''} <${entrada.de || ''}>`, `Asunto: ${entrada.asunto || ''}`, '', entrada.texto || '',
        ...(entrada.adjuntos || []).map((a, i) => `\n--- Adjunto ${i + 1}: ${a.nombre} ---\n${a.texto || ''}`),
      ].join('\n').slice(0, MAX_CARACTERES);
      let r;
      try {
        r = await fetchFn('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
          body: JSON.stringify({
            model: modelo,
            messages: [{ role: 'system', content: plantilla.instrucciones }, { role: 'user', content: contenido }],
            response_format: { type: 'json_schema', json_schema: { name: plantilla.nombre, strict: true, schema: plantilla.esquema } },
          }),
          signal: AbortSignal.timeout(60e3),
        });
      } catch (e) { return { ok: false, motivo: `La IA no responde (${e.message})` }; }
      if (!r.ok) return { ok: false, motivo: `La IA respondió ${r.status}` };
      const j = await r.json();
      const uso = j.usage || {};
      const coste = ((uso.prompt_tokens || 0) * precioEntrada + (uso.completion_tokens || 0) * precioSalida) / 1e6;
      if (coste > 0) await almacen.sumarGasto(coste);
      let datos;
      try { datos = JSON.parse(j.choices[0].message.content); } catch { return { ok: false, motivo: 'La IA no devolvió JSON' }; }
      return { ok: true, datos, uso: { modelo, entrada: uso.prompt_tokens || 0, salida: uso.completion_tokens || 0, coste_usd: coste } };
    },
  };
}
