# Datos climáticos — La Pobla Tornesa

Consulta interactiva de la serie climática diaria de La Pobla Tornesa.

Aplicación web estática: los datos se cargan en el navegador (DuckDB-WASM) y se pueden explorar por distintas combinaciones temporales (por ejemplo, la temperatura de un mes en todos los años).

## Datos

| Campo | Valor |
|--------|--------|
| Periodo | 2015-01-01 — 2026-06-30 |
| Observaciones | 4199 días (serie continua) |
| Frecuencia | Diaria |
| Archivo | `data/CLIMATOLOGICALDATA.csv` |
| Fuente | Estació meteorològica pl. del Portal de la Pobla Tornesa, E-12191, Castelló, Spain |

Variables principales: temperatura (media, máxima, mínima), lluvia, humedad, viento, presión y otras medidas derivadas de la estación.

El año 2026 está incompleto (datos hasta el 30 de junio).

## Consultas previstas (MVP)

1. Temperatura de un mes concreto en todos los años  
2. Temperaturas máximas diarias de un mes y año (gráfica) — **activa**  
3. Lluvia acumulada por mes o por año  

## Desarrollo local

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite (por defecto `http://localhost:5173/`).

**Importante:** no abras `index.html` a doble clic ni con `file://`. Sin el servidor de Vite la página queda en blanco (los módulos ES, WASM y el CSV no cargan).

## Estado del proyecto

- [x] Datos limpios en CSV (fechas ISO)  
- [x] Prototipo web local (carga CSV + consulta 1)  
- [ ] Publicación (GitHub Pages u equivalente)  

## Estructura

```text
.
├── data/
│   └── CLIMATOLOGICALDATA.csv
├── src/
│   ├── db.js          # DuckDB-WASM + carga del CSV
│   ├── queries.js     # Consultas SQL
│   ├── main.js        # UI
│   └── style.css
├── index.html
└── package.json
```
