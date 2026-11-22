"""Abrir el OCEL 2.0 de Ada con PM4Py y sacar el mapa del proceso (uso INTERNO).

PM4Py es AGPL-3.0: sirve para analizar en nuestro PC o servidor, pero no se mete dentro del producto
que se vende (eso obligaría a abrir su código). El producto usa src/nucleo/proceso.js, que es nuestro.

Uso:
  node src/simulacion/cli.js oficina plantillas-empresa/distribuidor-tornilleria.json --replicas 1 --ocel ocel.json
  pip install pm4py
  python3 analisis/proceso_pm4py.py ocel.json
"""
import sys
import pm4py

ocel = pm4py.read_ocel2_json(sys.argv[1])
print(ocel)
ocdfg = pm4py.discover_ocdfg(ocel)
for tipo, aristas in ocdfg["edges"]["event_couples"].items():
    print(f"\n== {tipo}: pasos más frecuentes ==")
    for (a, b), casos in sorted(aristas.items(), key=lambda x: -len(x[1]))[:10]:
        print(f"{len(casos):>7}  {a}  →  {b}")
if len(sys.argv) > 2:
    pm4py.save_vis_ocdfg(ocdfg, sys.argv[2])
    print(f"\nMapa guardado en {sys.argv[2]}")
