# Familia Ada · Ada base

Oficinas online para pymes (ada-office, ada-commercial, ada-customer-service, ada-ti, ada-bi, ada-fábrica, ada-infra). Este repo tiene el **Ada base**: la oficina común que usan todas, y las plantillas de cada oficina. Node ≥ 22, sin dependencias.

El Ada del canal y la captación (`larceing/ada`) es otro sistema y no se toca desde aquí.

## Cómo trabaja una oficina

| Puesto | Quién | Qué hace |
|---|---|---|
| Recepción | reglas | Recibe lo que entra (correo, otra oficina…), lee los adjuntos y decide si le toca. Si no, lo aparta |
| Gestión | reglas + IA | Saca los datos y los cruza con lo que la oficina sabe (clientes, catálogo, equivalencias). La IA solo si las reglas no bastan |
| Supervisión | persona | Aprueba, corrige o descarta. Lo corregido se aprende. Lo limpio pasa solo si el cliente tiene piloto automático |
| Registro | reglas | Lo lleva al destino (ERP, hoja…) y avisa a las demás oficinas |
| Seguimiento | persona | Estados posteriores en orden (p. ej. confirmado → en producción → servido) y lo atascado |
| Incidencias | persona | Cualquier fallo de un puesto acaba aquí con su tipo; se reintenta desde ese puesto |

Las oficinas se pasan el trabajo por el **bus** (`pedidos.registrado` → Producción). Cada evento sale también a los webhooks del espacio, firmado, para enganchar el n8n del cliente, Zapier, Make o su ERP.

## Piezas

```
src/nucleo/        Igual en el servidor y en el navegador (laboratorio). Sin nada de Node.
  oficina.js       Los seis puestos, aprobar, descartar, recuperar, reintentar, seguir, tablero
  bus.js           El pasillo entre oficinas
  memoria.js       Almacén en memoria (laboratorio y pruebas)
  similitud.js     Cruce aproximado sin IA (erratas, referencia propia del cliente, descripción): puntuación 0..1
  metricas.js      Cuánto pasa solo, cuánto corrige la persona y cuánto tarda (el «valor humano» medido)
  proceso.js       Tablero de proceso: tiempo y cola por puesto, transiciones, cuello de botella
  ocel.js          El historial en OCEL 2.0 (estándar de process mining; lo lee PM4Py)
  plantillas/      Qué es un caso en cada oficina: comercial.js, pedido.js, produccion.js, planta.js
src/node/          Lo que solo existe en el servidor
  correo.js        Leer .eml (MIME, base64, quoted-printable, adjuntos)
  extraer.js       Texto de adjuntos: PDF (pdftotext), escaneado (OCR con tesseract), Excel, CSV
  ia.js            API de OpenAI, solo texto, con tope de gasto por espacio
  almacen.js       Ficheros en /datos/<espacio>/<oficina>/ (se cambiará por PostgreSQL)
  webhooks.js      Eventos hacia fuera, firmados con HMAC
  destinos/        A qué ERP va lo registrado: sindri, holded, odoo, business-central y fichero (CSV para Sage, A3…).
                   Se montan desde config.destinos; los secretos van en variables de entorno (campo *_env), nunca en la config
src/simulacion/    Modo simulación: las mismas oficinas con reloj rápido, pedidos falsos y personas simuladas
  azar.js          Azar con semilla y variables con rango (mín., probable, máx.) o lognormal
  generador.js     Un año de pedidos falsos con su «verdad» (estacionalidad, formatos, referencias propias, erratas, duplicados)
  motor.js         Eventos discretos: cola en Supervisión, jornada, ausencias, interrupciones, errores; escenario manual o con Ada
  montecarlo.js    Repite la simulación y da P10/P50/P90 y el ahorro (horas, errores, euros)
  empresa.js       Empresa desde cero: modelo en JSON con fuente por variable → coste, equilibrio, caja, sensibilidad
  cli.js           npm run simular · npm run empresa · cli.js ocel /datos/<espacio>
plantillas-empresa/ Modelos de ejemplo: distribuidor-tornilleria.json (oficina) e importacion-motos.json (empresa)
analisis/          proceso_pm4py.py: abrir el OCEL con PM4Py (solo uso interno: PM4Py es AGPL)
visual/            La oficina isométrica de los vídeos para copiar a otro sistema, y ada-infra (BD, ejecuciones,
                   controles, unidades de red, copias, servidores). Ver visual/LEEME.md
banco/             Banco de pruebas: correos inventados con y sin adjuntos
test/              node --test
```

## Una plantilla

Un módulo nuevo no es un programa nuevo: es una plantilla con `nombre`, `clasificar`, `extraer`, `validar` y, si hace falta, `identificar`, `esquema` + `instrucciones` (IA), `unir`, `corregir`, `estadosSeguimiento`, `escucha` + `desdeEvento` (trabajo de otra oficina) y `puestos` (qué hace cada puesto en esta oficina).

## Probar

```
npm test                  # 36 pruebas (cadena entre oficinas, destinos, cruce, métricas, OCEL, simulación)
npm run simular           # un año de pedidos falsos, 20 veces: una persona tecleando frente a Ada (≈1 min)
npm run empresa           # caso motos: 10.000 años simulados del importador de scooters
node banco/generar.js     # crea banco/correos/*.eml
node banco/probar.js      # pasa el banco por la oficina de Pedidos y enseña el resultado
```

Para leer PDF hace falta `pdftotext` (poppler) y, para escaneados, `pdftoppm` + `tesseract` con español.

## Cruce, métricas y simulación

- **Cruce aproximado** (`config.cruce`): `proponer` (0,6 por defecto) pone en el aviso la referencia más parecida con su puntuación; la persona la acepta con `aceptar_propuestas: true`. `auto` (apagado por defecto) la da por buena sin persona si supera el umbral y el segundo candidato queda a más de 0,05. Por defecto no se activa: «TOR-M6-30» y «TOR-M8-30» se parecen mucho y son productos distintos.
- **Métricas** (`oficina.metricas()`): % sin tocar, % aprobado tal cual, % con correcciones, espera en Supervisión (P50/P90), tiempo hasta registro, líneas por tipo de cruce y gasto de IA.
- **Proceso** (`oficina.proceso()`): por puesto, estancia P50/P90, parte del tiempo, cola ahora y espera más larga; transiciones y cuello de botella.
- **Simulación**: usa las mismas oficinas. Los tiempos de las personas son supuestos hasta que haya datos reales; entonces se ponen en el modelo los de `metricas()`. El resultado vale lo que valen los supuestos: cada variable lleva su `fuente` y lo que no la tiene sale en `sin_fuente`.

## Reglas

- La API de OpenAI solo para texto. Nunca imágenes.
- Ninguna clave en el repo. Datos de clientes solo en `/datos` del servidor.
- Nada se registra sin Supervisión salvo el piloto automático, que se activa por cliente.
- PM4Py (AGPL) solo para análisis interno, nunca dentro del producto.

## Dónde se ve

El laboratorio de Arce Data Lab (`/lab/#sindri`) monta cuatro oficinas con este núcleo: Comercial, Pedidos, Producción y Planta y almacén. Copia el núcleo en `src/p/ada-base/` del laboratorio (`DESARROLLO\demos\laboratorio` en el PC; se publica en `larceing/web-portafolio`, carpeta `lab/`); si cambias `src/nucleo`, cópialo allí y reconstruye.
