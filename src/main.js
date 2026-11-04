import './style.css'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
)

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
    <p class="lede">Los récords de la serie y, debajo, una gráfica. El selector cambia cuál se muestra.</p>
  </header>

  <p id="status" class="status" role="status">Cargando datos…</p>

  <section id="records" class="records" hidden aria-labelledby="records-title">
    <h2 id="records-title">Récords</h2>
    <p class="records-note">Extremos de toda la serie diaria.</p>
    <div id="record-grid" class="record-grid"></div>
  </section>

  <form id="query-form" class="query-form" hidden>
    <label>
      Gráfica
      <select id="vista" name="vista">
        <option value="maximas">Máximas diarias</option>
        <option value="anio-temp">Año tipo · temperatura</option>
        <option value="anio-lluvia">Año tipo · lluvia</option>
      </select>
    </label>
    <div id="maximas-filters" class="maximas-filters">
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
    </div>
  </form>

  <section id="results" class="results" aria-live="polite"></section>
`

const statusEl = document.querySelector('#status')
const recordsEl = document.querySelector('#records')
const recordGridEl = document.querySelector('#record-grid')
const formEl = document.querySelector('#query-form')
const vistaEl = document.querySelector('#vista')
const maximasFiltersEl = document.querySelector('#maximas-filters')
const resultsEl = document.querySelector('#results')
const monthEl = document.querySelector('#month')
const yearEl = document.querySelector('#year')

let chart = null

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const EJE = {
  ticks: { color: '#4d646e' },
  grid: { color: 'rgba(183, 205, 214, 0.45)' },
  title: { color: '#4d646e' },
}

function destroyChart() {
  if (chart) {
    chart.destroy()
    chart = null
  }
}

function mesDe(fila) {
  return MESES.find((m) => m.value === fila.mes)?.label ?? String(fila.mes)
}

function extremo(filas, clave, sentido) {
  return filas.reduce((mejor, fila) => {
    if (!mejor) return fila
    return sentido * fila[clave] > sentido * mejor[clave] ? fila : mejor
  }, null)
}

function periodoTipo(datos) {
  if (!datos.desde || !datos.hasta) return 'Sin años completos en la serie.'
  return `Media de ${datos.desde} a ${datos.hasta}. Cada año completo pesa igual.`
}

function montarGrafica(canvas, config) {
  destroyChart()
  chart = new Chart(canvas, config)
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

  destroyChart()
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

  const canvas = document.querySelector('#temp-chart')
  montarGrafica(canvas, {
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

function renderAnioTemperatura(datos) {
  const filas = datos.meses
  if (!filas.length) {
    destroyChart()
    resultsEl.innerHTML = `<p class="empty">No hay años completos para calcular el año tipo.</p>`
    return
  }

  const calido = extremo(filas, 'temp_max', 1)
  const frio = extremo(filas, 'temp_min', -1)

  destroyChart()
  resultsEl.innerHTML = `
    <div class="chart-header">
      <h2>Año tipo · temperatura</h2>
      <p class="chart-summary">
        ${periodoTipo(datos)}
        ${mesDe(calido)} es el mes de máximas más altas (${formatoNumero(calido.temp_max)} °C)
        y ${mesDe(frio).toLowerCase()} el de mínimas más bajas (${formatoNumero(frio.temp_min)} °C).
      </p>
    </div>
    <div class="chart-wrap">
      <canvas id="temp-chart" aria-label="Temperatura media de cada mes del año tipo"></canvas>
    </div>
  `

  const etiquetas = filas.map((fila) => MESES_CORTOS[fila.mes - 1])
  const linea = (label, clave, color) => ({
    label,
    data: filas.map((fila) => fila[clave]),
    borderColor: color,
    backgroundColor: color,
    pointRadius: 3,
    pointHoverRadius: 5,
    borderWidth: 2,
    tension: 0.25,
  })

  montarGrafica(document.querySelector('#temp-chart'), {
    type: 'line',
    data: {
      labels: etiquetas,
      datasets: [
        linea('Máxima', 'temp_max', '#0a5570'),
        linea('Media', 'temp_media', '#0f6e8c'),
        linea('Mínima', 'temp_min', '#7eb0c2'),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#1a2b33' } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatoNumero(item.parsed.y)} °C`,
          },
        },
      },
      scales: {
        x: { ...EJE, title: { ...EJE.title, display: true, text: 'Mes' } },
        y: { ...EJE, title: { ...EJE.title, display: true, text: '°C' } },
      },
    },
  })
}

function renderAnioLluvia(datos) {
  const filas = datos.meses
  if (!filas.length) {
    destroyChart()
    resultsEl.innerHTML = `<p class="empty">No hay años completos para calcular el año tipo.</p>`
    return
  }

  const humedo = extremo(filas, 'lluvia', 1)
  const seco = extremo(filas, 'lluvia', -1)

  destroyChart()
  resultsEl.innerHTML = `
    <div class="chart-header">
      <h2>Año tipo · lluvia</h2>
      <p class="chart-summary">
        ${periodoTipo(datos)}
        ${mesDe(humedo)} concentra la lluvia (${formatoNumero(humedo.lluvia)} mm)
        y ${mesDe(seco).toLowerCase()} es el mes más seco (${formatoNumero(seco.lluvia)} mm).
      </p>
    </div>
    <div class="chart-wrap">
      <canvas id="temp-chart" aria-label="Lluvia media de cada mes del año tipo"></canvas>
    </div>
  `

  montarGrafica(document.querySelector('#temp-chart'), {
    type: 'bar',
    data: {
      labels: filas.map((fila) => MESES_CORTOS[fila.mes - 1]),
      datasets: [
        {
          label: 'Lluvia',
          data: filas.map((fila) => fila.lluvia),
          backgroundColor: 'rgba(15, 110, 140, 0.75)',
          borderColor: '#0f6e8c',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${formatoNumero(item.parsed.y)} mm`,
          },
        },
      },
      scales: {
        x: { ...EJE, title: { ...EJE.title, display: true, text: 'Mes' } },
        y: {
          ...EJE,
          beginAtZero: true,
          title: { ...EJE.title, display: true, text: 'mm' },
        },
      },
    },
  })
}

async function start() {
  try {
    const { initDb, countRows } = await import('./db.js')
    const { aniosDisponibles, anioTipo, recordsSerie, tempsMaximasMesAnio } = await import('./queries.js')

    await initDb()
    const [n, anios, records, anio] = await Promise.all([
      countRows(),
      aniosDisponibles(),
      recordsSerie(),
      anioTipo(),
    ])
    renderRecords(records)

    yearEl.innerHTML = anios
      .map((y) => `<option value="${y}">${y}</option>`)
      .join('')

    const ultimoAnio = anios[anios.length - 1]
    yearEl.value = String(ultimoAnio)
    // 2026 está incompleto: evita un mes vacío al cargar
    monthEl.value = String(ultimoAnio >= 2026 ? 6 : 7)

    let solicitud = 0

    async function mostrarVista() {
      const token = ++solicitud
      const vista = vistaEl.value
      maximasFiltersEl.hidden = vista !== 'maximas'
      resultsEl.innerHTML = `<p class="empty">Consultando…</p>`
      destroyChart()

      try {
        if (vista === 'anio-temp') {
          if (token !== solicitud) return
          renderAnioTemperatura(anio)
          return
        }
        if (vista === 'anio-lluvia') {
          if (token !== solicitud) return
          renderAnioLluvia(anio)
          return
        }

        const mes = Number(monthEl.value)
        const anyo = Number(yearEl.value)
        const rows = await tempsMaximasMesAnio(mes, anyo)
        if (token !== solicitud) return
        renderChart(rows, mes, anyo)
      } catch (error) {
        if (token !== solicitud) return
        resultsEl.innerHTML = `<p class="error">${error.message}</p>`
      }
    }

    vistaEl.addEventListener('change', () => {
      mostrarVista()
    })

    formEl.addEventListener('submit', (event) => {
      event.preventDefault()
      mostrarVista()
    })

    statusEl.textContent = `Listo · ${n.toLocaleString('es-ES')} días cargados (2015–2026)`
    statusEl.classList.add('ready')
    formEl.hidden = false
    await mostrarVista()
  } catch (error) {
    console.error(error)
    statusEl.textContent = `Error al cargar los datos: ${error.message}`
    statusEl.classList.add('error')
  }
}

start()
