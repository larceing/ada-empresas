// Puerta abierta: lo que pasa en las oficinas sale a los webhooks del espacio (el n8n del cliente, Zapier, Make, su ERP…).
// Firmado con HMAC-SHA256 (cabecera X-Ada-Firma) para que el receptor sepa que viene de nosotros.
import crypto from 'node:crypto';

export function conectarWebhooks(bus, { espacio, webhooks = () => [], fetchFn = fetch, alFallar = () => {} }) {
  return bus.escuchar('*', async (datos, evento) => {
    for (const h of webhooks().filter((x) => !x.eventos || x.eventos.includes(evento))) {
      const cuerpo = JSON.stringify({ evento, espacio, fecha: new Date().toISOString(), datos });
      const firma = crypto.createHmac('sha256', h.secreto || '').update(cuerpo).digest('hex');
      try {
        const r = await fetchFn(h.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ada-Evento': evento, 'X-Ada-Firma': firma }, body: cuerpo, signal: AbortSignal.timeout(10e3) });
        if (!r.ok) alFallar({ url: h.url, evento, estado: r.status });
      } catch (e) { alFallar({ url: h.url, evento, error: e.message }); }
    }
  });
}
