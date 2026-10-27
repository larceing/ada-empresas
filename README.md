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
  plantillas/      Qué es un caso en cada oficina: comercial.js, pedido.js, produccion.js, planta.js
src/node/          Lo que solo existe en el servidor
  correo.js        Leer .eml (MIME, base64, quoted-printable, adjuntos)
  extraer.js       Texto de adjuntos: PDF (pdftotext), escaneado (OCR con tesseract), Excel, CSV
  ia.js            API de OpenAI, solo texto, con tope de gasto por espacio
  almacen.js       Ficheros en /datos/<espacio>/<oficina>/ (se cambiará por PostgreSQL)
  webhooks.js      Eventos hacia fuera, firmados con HMAC
visual/            La oficina isométrica de los vídeos para copiar a otro sistema, y ada-infra (BD, ejecuciones,
                   controles, unidades de red, copias, servidores). Ver visual/LEEME.md
banco/             Banco de pruebas: correos inventados con y sin adjuntos
test/              node --test
```

## Una plantilla

Un módulo nuevo no es un programa nuevo: es una plantilla con `nombre`, `clasificar`, `extraer`, `validar` y, si hace falta, `identificar`, `esquema` + `instrucciones` (IA), `unir`, `corregir`, `estadosSeguimiento`, `escucha` + `desdeEvento` (trabajo de otra oficina) y `puestos` (qué hace cada puesto en esta oficina).

## Probar

```
npm test                  # 16 pruebas (incluida la cadena Comercial → Pedidos → Producción → Planta)
node banco/generar.js     # crea banco/correos/*.eml
node banco/probar.js      # pasa el banco por la oficina de Pedidos y enseña el resultado
```

Para leer PDF hace falta `pdftotext` (poppler) y, para escaneados, `pdftoppm` + `tesseract` con español.

## Reglas

- La API de OpenAI solo para texto. Nunca imágenes.
- Ninguna clave en el repo. Datos de clientes solo en `/datos` del servidor.
- Nada se registra sin Supervisión salvo el piloto automático, que se activa por cliente.

## Dónde se ve

El laboratorio de Arce Data Lab (`/lab/#sindri`) monta cuatro oficinas con este núcleo: Comercial, Pedidos, Producción y Planta y almacén. Copia el núcleo en `src/p/ada-base/` del laboratorio (`DESARROLLO\demos\laboratorio` en el PC; se publica en `larceing/web-portafolio`, carpeta `lab/`); si cambias `src/nucleo`, cópialo allí y reconstruye.
