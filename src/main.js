import './style.css'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

const app = document.querySelector('#app')

app.innerHTML = `
  <header class="site-header">
    <p class="eyebrow">Serie climática diaria</p>
    <h1>La Pobla Tornesa</h1>
    <p class="lede">Elige un mes y un año para ver la gráfica de temperaturas máximas diarias.</p>
  </header>

  <p id="status" class="status" role="status">Cargando datos…</p>

  <section id="records" class="records" hidden aria-labelledby="records-title">
    <h2 id="records-title">Récords</h2>
    <p class="records-note">Extremos de toda la serie diaria.</p>
    <div id="record-grid" class="record-grid"></div>
  </section>

  <form id="query-form" class="query-form" hidden>
    <label>
      Mes
      <select id="month" name="month">
        ${MESES.map(
          (m) =>
            `<option value="${m.value}" ${m.value === 7 ? 'selected' : ''}>${m.label}</option>`,
        ).join('')}
      </select>
    </label>
    <label>
      Año
      <select id="year" name="year"></select>
    </label>
    <button type="submit">Consultar</button>
  </form>

  <section id="results" class="results" aria-live="polite"></section>
`

const statusEl = document.querySelector('#status')
const recordsEl = document.querySelector('#records')
const recordGridEl = document.querySelector('#record-grid')
const formEl = document.querySelector('#query-form')
const resultsEl = document.querySelector('#results')
const monthEl = document.querySelector('#month')
const yearEl = document.querySelector('#year')

let chart = null

function destroyChart() {
  if (chart) {
    chart.destroy()
    chart = null
  }
}

function formatoNumero(n) {
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function formatoFechas(fechas) {
  const textos = fechas.map((fecha) => {
    const mes = MESES.find((m) => m.value === fecha.mes)?.label.toLowerCase() ?? fecha.mes
    return `${fecha.dia} de ${mes} de ${fecha.anyo}`
  })
  if (textos.length <= 1) return textos[0] ?? 'Sin fecha'
  if (textos.length === 2) return `${textos[0]} y ${textos[1]}`
  return `${textos.slice(0, -1).join(', ')} y ${textos.at(-1)}`
}

function renderRecords(records) {
  const tarjetas = [
    { tipo: 'calor', etiqueta: 'Día más cálido', unidad: '°C' },
    { tipo: 'frio', etiqueta: 'Día más frío', unidad: '°C' },
    { tipo: 'lluvia', etiqueta: 'Día más lluvioso', unidad: 'mm' },
  ]

  recordGridEl.innerHTML = tarjetas
    .map(({ tipo, etiqueta, unidad }) => {
      const fechas = records[tipo] ?? []
      const valor = fechas[0]?.valor
      const cifra = Number.isFinite(valor) ? `${formatoNumero(valor)} ${unidad}` : '—'
      const cuando = fechas.length ? formatoFechas(fechas) : 'Sin datos'

      return `
        <article class="record-card">
          <h3 class="record-label">${etiqueta}</h3>
          <p class="record-value">${cifra}</p>
          <p class="record-date">${cuando}</p>
        </article>
      `
    })
    .join('')

  recordsEl.hidden = false
}

function renderChart(rows, mes, anyo) {
  const mesLabel = MESES.find((m) => m.value === mes)?.label ?? mes

  if (!rows.length) {
    destroyChart()
    resultsEl.innerHTML = `<p class="empty">No hay datos para ${mesLabel} de ${anyo}.</p>`
    return
  }

  const temps = rows.map((r) => r.temp_max)
  const max = Math.max(...temps)
  const min = Math.min(...temps)
  const pico = rows.find((r) => r.temp_max === max)

  resultsEl.innerHTML = `
    <div class="chart-header">
      <h2>Máximas · ${mesLabel} ${anyo}</h2>
      <p class="chart-summary">
        Pico ${max.toFixed(1)} °C el día ${pico.dia}
        · Mínima de las máximas ${min.toFixed(1)} °C
        · ${rows.length} días
      </p>
    </div>
    <div class="chart-wrap">
      <canvas id="temp-chart" aria-label="Gráfica de temperaturas máximas"></canvas>
    </div>
  `

  destroyChart()
  const canvas = document.querySelector('#temp-chart')
  chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: rows.map((r) => String(r.dia)),
      datasets: [
        {
          label: 'Temp. máxima (°C)',
          data: temps,
          borderColor: '#0f6e8c',
          backgroundColor: 'rgba(15, 110, 140, 0.12)',
          pointBackgroundColor: '#0f6e8c',
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Día ${items[0].label}`,
            label: (item) => `${item.formattedValue} °C`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Día del mes', color: '#4d646e' },
          grid: { color: 'rgba(183, 205, 214, 0.45)' },
          ticks: { color: '#4d646e' },
        },
        y: {
          title: { display: true, text: '°C', color: '#4d646e' },
          grid: { color: 'rgba(183, 205, 214, 0.45)' },
          ticks: { color: '#4d646e' },
        },
      },
    },
  })
}

async function start() {
  try {
    const { initDb, countRows } = await import('./db.js')
    const { aniosDisponibles, recordsSerie, tempsMaximasMesAnio } = await import('./queries.js')

    await initDb()
    const [n, anios, records] = await Promise.all([
      countRows(),
      aniosDisponibles(),
      recordsSerie(),
    ])
    renderRecords(records)

    yearEl.innerHTML = anios
      .map((y) => `<option value="${y}">${y}</option>`)
      .join('')

    const ultimoAnio = anios[anios.length - 1]
    yearEl.value = String(ultimoAnio)
    // 2026 está incompleto (hasta junio): evita un mes vacío al cargar
    monthEl.value = String(ultimoAnio >= 2026 ? 6 : 7)

    async function runQuery() {
      const mes = Number(monthEl.value)
      const anyo = Number(yearEl.value)
      resultsEl.innerHTML = `<p class="empty">Consultando…</p>`
      destroyChart()
      try {
        const rows = await tempsMaximasMesAnio(mes, anyo)
        renderChart(rows, mes, anyo)
      } catch (error) {
        resultsEl.innerHTML = `<p class="error">${error.message}</p>`
      }
    }

    formEl.addEventListener('submit', (event) => {
      event.preventDefault()
      runQuery()
    })

    statusEl.textContent = `Listo · ${n.toLocaleString('es-ES')} días cargados (2015–2026)`
    statusEl.classList.add('ready')
    formEl.hidden = false
    await runQuery()
  } catch (error) {
    console.error(error)
    statusEl.textContent = `Error al cargar los datos: ${error.message}`
    statusEl.classList.add('error')
  }
}

start()
