# Ada visual · la oficina para cualquier sistema (y ada-infra)

La oficina isométrica de Ada (la de los vídeos) lista para copiar a otro proyecto. Sin librerías, sin servidor y sin llamadas a internet: tres archivos JS/CSS y las fuentes. Abre `ejemplo-infra.html` con doble clic para verla con datos inventados.

| Archivo | Qué es |
|---|---|
| `mundo.js` + `mundo.css` | La oficina (copia de `larceing/ada`, `public/`, con iconos de infra añadidos). Expone `window.MundoAda` |
| `infra.js` | **ada-infra**: convierte comprobaciones de infra en los datos de la oficina. Expone `window.AdaInfra` |
| `ejemplo-infra.html` + `ejemplo.js` + `ejemplo.css` | Página de ejemplo: KPIs, oficina y lateral con lo que hay que mirar |
| `fuentes/`, `icono.svg` | Roboto Flex servida desde el propio sitio y el icono de Ada |

## Copiarlo a tu sistema de tareas

1. Copia la carpeta `visual/` entera a los estáticos de tu web (o solo `mundo.js`, `mundo.css`, `infra.js` y `fuentes/`).
2. En tu página: un `<div id="mundo"></div>` y los scripts `mundo.js` e `infra.js`.
3. Pide a tu API la lista de comprobaciones y pinta:

```js
MundoAda.montar(document.getElementById('mundo'), { alElegir: (id) => { /* abre tu ficha */ } });
async function refrescar() {
  const comprobaciones = await (await fetch('/api/infra/comprobaciones')).json();
  MundoAda.pintar(AdaInfra.aDatos(comprobaciones, { caducaMin: 30 }), elegido);
}
refrescar(); setInterval(refrescar, 60000);
```

La oficina solo dibuja: no lee nada por su cuenta ni guarda nada. Lo que sale en pantalla es lo que tu sistema le pasa.

## Lo que tiene que devolver tu sistema

Una lista de comprobaciones, una por cosa vigilada:

```json
[
  { "id": "bd-erp", "tipo": "bd", "nombre": "SQL ERP", "estado": "ok", "detalle": "Responde en 40 ms", "cuando": "2026-10-27T10:00:00Z" },
  { "id": "job-etl", "tipo": "ejecucion", "nombre": "Carga nocturna", "estado": "error", "detalle": "Timeout 03:12", "cuando": "2026-10-27T03:12:00Z" }
]
```

| Campo | Valores |
|---|---|
| `tipo` | `bd`, `ejecucion`, `control`, `red`, `copia`, `servicio` (un puesto por tipo; los desconocidos van a `servicio`) |
| `estado` | `ok`, `aviso`, `error`, `corriendo`, `apagado` |
| `cuando` | Última vez que se comprobó. Si pasa de `caducaMin` minutos, se marca «Sin datos desde hace…» |
| `caducaMin` | Opcional por comprobación (p. ej. 1500 para un job diario) |

Tipos propios: `AdaInfra.aDatos(lista, { tipos: { sap: { nombre: 'SAP', icono: 'servidor', descripcion: '…' } } })`. Iconos disponibles: los de `ICONOS` en `mundo.js` (`bd`, `servidor`, `disco`, `engranaje`, `escudo`, `copia`, `reloj`, `alerta`, `latido`, `correo`…).

## Qué hace cada estado en la oficina

| Estado del puesto | Se ve |
|---|---|
| ok | Pantalla azul, trabajando tranquilo |
| corriendo | Teclea (hay algo en marcha) |
| aviso | Pantalla ámbar, espera; número en el cartel |
| error | Pantalla roja con «!», humo; número en el cartel |
| apagado (todas) | Dormido |

Al pulsar un puesto se ve de frente con sus comprobaciones (las peores primero) como «herramientas».

## Cosas a tener en cuenta

- Cumple una CSP estricta (sin `style` en línea; las variables van por CSSOM). Con «reducir movimiento» del sistema no se anima.
- Las comprobaciones (conectar a la BD, mirar la unidad de red, leer el estado del job) las hace tu sistema de tareas con sus propias credenciales. Aquí no hay ninguna.
- Si cambias `mundo.js` en `larceing/ada`, cópialo aquí a mano y vuelve a añadir los iconos de infra (están marcados con `// infra (ada-infra)`).
