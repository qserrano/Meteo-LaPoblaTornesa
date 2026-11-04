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
        <option value="mes-anios">Un mes frente a los otros años</option>
        <option value="anio-temp">Año tipo · temperatura</option>
        <option value="dia-tipo">Día tipo</option>
        <option value="calor-helada">Días de calor y de helada</option>
        <option value="anio-lluvia">Año tipo · lluvia</option>
        <option value="episodios">Lluvia · episodios</option>
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

function mesCorto(mes) {
  return (MESES_CORTOS[mes - 1] ?? String(mes)).toLowerCase()
}

function mismaFecha(a, b) {
  return a.dia === b.dia && a.mes === b.mes && a.anyo === b.anyo
}

function fraseEpisodio(ep) {
  const { inicio, fin } = ep
  const mesInicio = mesDe(inicio).toLowerCase()
  const mesFin = mesDe(fin).toLowerCase()
  if (mismaFecha(inicio, fin)) {
    return `el ${inicio.dia} de ${mesInicio} de ${inicio.anyo}`
  }
  if (inicio.mes === fin.mes && inicio.anyo === fin.anyo) {
    return `del ${inicio.dia} al ${fin.dia} de ${mesInicio} de ${inicio.anyo}`
  }
  if (inicio.anyo === fin.anyo) {
    return `del ${inicio.dia} de ${mesInicio} al ${fin.dia} de ${mesFin} de ${inicio.anyo}`
  }
  return `del ${inicio.dia} de ${mesInicio} de ${inicio.anyo} al ${fin.dia} de ${mesFin} de ${fin.anyo}`
}

function etiquetaEpisodio(ep) {
  const { inicio, fin } = ep
  if (mismaFecha(inicio, fin)) {
    return `${inicio.dia} ${mesCorto(inicio.mes)} ${inicio.anyo}`
  }
  if (inicio.mes === fin.mes && inicio.anyo === fin.anyo) {
    return `${inicio.dia}–${fin.dia} ${mesCorto(inicio.mes)} ${inicio.anyo}`
  }
  if (inicio.anyo === fin.anyo) {
    return `${inicio.dia} ${mesCorto(inicio.mes)}–${fin.dia} ${mesCorto(fin.mes)} ${inicio.anyo}`
  }
  return `${inicio.dia} ${mesCorto(inicio.mes)} ${inicio.anyo}–${fin.dia} ${mesCorto(fin.mes)} ${fin.anyo}`
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

function formatoHora(horas) {
  const total = Math.round(Number(horas) * 60)
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')}`
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

function renderEpisodiosLluvia(datos) {
  const { episodios, total, umbralRacha, umbralPico } = datos
  if (!episodios.length) {
    destroyChart()
    resultsEl.innerHTML = `<p class="empty">No hay episodios de lluvia en la serie.</p>`
    return
  }

  const suma = episodios.reduce((acumulado, ep) => acumulado + ep.lluvia, 0)
  const pct = total > 0 ? Math.round((suma / total) * 100) : 0
  const mayor = extremo(episodios, 'lluvia', 1)
  const mmUmbral = (n) =>
    `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} mm`
  const racha = mmUmbral(umbralRacha)
  const pico = mmUmbral(umbralPico)

  destroyChart()
  resultsEl.innerHTML = `
    <div class="chart-header">
      <h2>Lluvia · episodios</h2>
      <p class="chart-summary">
        Una racha de días seguidos con al menos ${racha}, si alguno llega a ${pico}, cuenta como episodio.
        Hay ${episodios.length} y reúnen ${formatoNumero(suma)} mm, el ${pct}% de toda la lluvia.
        La mayor va ${fraseEpisodio(mayor)} y dejó ${formatoNumero(mayor.lluvia)} mm.
      </p>
    </div>
    <div class="chart-wrap" id="episode-chart-wrap">
      <canvas id="temp-chart" aria-label="Lluvia acumulada en cada episodio"></canvas>
    </div>
  `

  const wrap = document.querySelector('#episode-chart-wrap')
  wrap.style.height = `${Math.max(420, episodios.length * 28 + 56)}px`

  montarGrafica(document.querySelector('#temp-chart'), {
    type: 'bar',
    data: {
      labels: episodios.map(etiquetaEpisodio),
      datasets: [
        {
          label: 'Lluvia',
          data: episodios.map((ep) => ep.lluvia),
          backgroundColor: 'rgba(15, 110, 140, 0.75)',
          borderColor: '#0f6e8c',
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const ep = episodios[item.dataIndex]
              const dias = ep.dias === 1 ? '1 día' : `${ep.dias} días`
              return `${formatoNumero(ep.lluvia)} mm en ${dias} · pico ${formatoNumero(ep.pico)} mm`
            },
          },
        },
      },
      scales: {
        x: {
          ...EJE,
          beginAtZero: true,
          title: { ...EJE.title, display: true, text: 'mm' },
        },
        y: {
          ...EJE,
          ticks: { ...EJE.ticks, autoSkip: false, font: { size: 11 } },
        },
      },
    },
  })
}

function renderMesFrenteAnios(rows, mes, anyo) {
  const mesLabel = MESES.find((m) => m.value === mes)?.label ?? String(mes)

  if (!rows.length) {
    destroyChart()
    resultsEl.innerHTML = `<p class="empty">No hay datos de ${mesLabel.toLowerCase()}.</p>`
    return
  }

  const elegido = rows.find((fila) => fila.anyo === anyo)
  const masCalido = extremo(rows, 'temp_max', 1)
  const masFrio = extremo(rows, 'temp_min', -1)
  const extremos = `La máxima más alta fue ${formatoNumero(masCalido.temp_max)} °C en ${masCalido.anyo} y la mínima más baja ${formatoNumero(masFrio.temp_min)} °C en ${masFrio.anyo}.`
  const resumen = elegido
    ? `${mesLabel} de ${anyo}, marcado en naranja: máxima ${formatoNumero(elegido.temp_max)} °C, media ${formatoNumero(elegido.temp_media)} °C, mínima ${formatoNumero(elegido.temp_min)} °C. ${extremos}`
    : `No hay datos de ${mesLabel.toLowerCase()} de ${anyo}. ${extremos}`

  destroyChart()
  resultsEl.innerHTML = `
    <div class="chart-header">
      <h2>${mesLabel} frente a los otros años</h2>
      <p class="chart-summary">${resumen}</p>
    </div>
    <div class="chart-wrap">
      <canvas id="temp-chart" aria-label="Temperatura de ${mesLabel} en cada año"></canvas>
    </div>
  `

  const marcado = (color) => ({
    pointBackgroundColor: rows.map((fila) => (fila.anyo === anyo ? '#c45c26' : color)),
    pointBorderColor: rows.map((fila) => (fila.anyo === anyo ? '#c45c26' : color)),
    pointRadius: rows.map((fila) => (fila.anyo === anyo ? 6 : 3)),
    pointHoverRadius: rows.map((fila) => (fila.anyo === anyo ? 8 : 5)),
  })
  const linea = (label, clave, color) => ({
    label,
    data: rows.map((fila) => fila[clave]),
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    tension: 0.25,
    ...marcado(color),
  })

  montarGrafica(document.querySelector('#temp-chart'), {
    type: 'line',
    data: {
      labels: rows.map((fila) => String(fila.anyo)),
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
            title: (items) => {
              const fila = rows[items[0].dataIndex]
              return fila.anyo === anyo ? `${fila.anyo} · año elegido` : String(fila.anyo)
            },
            label: (item) => `${item.dataset.label}: ${formatoNumero(item.parsed.y)} °C`,
            footer: (items) => `${rows[items[0].dataIndex].dias} días`,
          },
        },
      },
      scales: {
        x: { ...EJE, title: { ...EJE.title, display: true, text: 'Año' } },
        y: { ...EJE, title: { ...EJE.title, display: true, text: '°C' } },
      },
    },
  })
}

function renderDiaTipo(datos) {
  const meses = datos.meses
  if (!meses.length) {
    destroyChart()
    resultsEl.innerHTML = `<p class="empty">No hay horas de máxima y mínima en la serie.</p>`
    return
  }

  const maxTarde = extremo(meses, 'hora_max', 1)
  const maxPronto = extremo(meses, 'hora_max', -1)
  const minTarde = extremo(meses, 'hora_min', 1)
  const minPronto = extremo(meses, 'hora_min', -1)
  const ampMax = extremo(meses, 'amplitud', 1)
  const ampMin = extremo(meses, 'amplitud', -1)

  destroyChart()
  resultsEl.innerHTML = `
    <div class="chart-header">
      <h2>Día tipo</h2>
      <p class="chart-summary">
        Hora mediana de cada mes. La máxima cae entre las ${formatoHora(maxPronto.hora_max)}
        de ${mesDe(maxPronto).toLowerCase()} y las ${formatoHora(maxTarde.hora_max)}
        de ${mesDe(maxTarde).toLowerCase()}; la mínima, entre las ${formatoHora(minPronto.hora_min)}
        de ${mesDe(minPronto).toLowerCase()} y las ${formatoHora(minTarde.hora_min)}
        de ${mesDe(minTarde).toLowerCase()}.
        La amplitud del día se mantiene entre ${formatoNumero(ampMin.amplitud)}
        y ${formatoNumero(ampMax.amplitud)} °C.
      </p>
    </div>
    <div class="chart-wrap">
      <canvas id="temp-chart" aria-label="Hora mediana de la máxima y la mínima en cada mes"></canvas>
    </div>
  `

  const linea = (label, clave, color) => ({
    label,
    data: meses.map((fila) => fila[clave]),
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
      labels: meses.map((fila) => MESES_CORTOS[fila.mes - 1]),
      datasets: [
        linea('Hora de la máxima', 'hora_max', '#c45c26'),
        linea('Hora de la mínima', 'hora_min', '#0f6e8c'),
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
            label: (item) => `${item.dataset.label}: ${formatoHora(item.parsed.y)}`,
            footer: (items) => `Amplitud ${formatoNumero(meses[items[0].dataIndex].amplitud)} °C`,
          },
        },
      },
      scales: {
        x: { ...EJE, title: { ...EJE.title, display: true, text: 'Mes' } },
        y: {
          ...EJE,
          min: 0,
          max: 24,
          ticks: {
            ...EJE.ticks,
            stepSize: 3,
            callback: (value) => `${value} h`,
          },
          title: { ...EJE.title, display: true, text: 'Hora del día' },
        },
      },
    },
  })
}

function listaAnios(anyos) {
  if (anyos.length <= 1) return String(anyos[0] ?? '')
  if (anyos.length === 2) return `${anyos[0]} y ${anyos[1]}`
  return `${anyos.slice(0, -1).join(', ')} y ${anyos.at(-1)}`
}

function aniosEnElMaximo(filas, clave) {
  const valor = Math.max(...filas.map((fila) => fila[clave]))
  return {
    valor,
    anyos: filas.filter((fila) => fila[clave] === valor).map((fila) => fila.anyo),
  }
}

function renderCalorHelada(filas) {
  if (!filas.length) {
    destroyChart()
    resultsEl.innerHTML = `<p class="empty">No hay días para contar.</p>`
    return
  }

  const suma = (clave) => filas.reduce((total, fila) => total + fila[clave], 0)
  const completos = filas.filter((fila) => fila.meses >= 12)
  const abiertos = filas.filter((fila) => fila.meses < 12)
  const masCalor = aniosEnElMaximo(completos, 'calor')
  const masHelada = aniosEnElMaximo(completos, 'helada')
  const entero = (n) => n.toLocaleString('es-ES')

  const fraseCompletos = completos.length
    ? ` Entre los años completos, el máximo de días de calor es ${entero(masCalor.valor)} (${listaAnios(masCalor.anyos)}) y el de heladas es ${entero(masHelada.valor)} (${listaAnios(masHelada.anyos)}).`
    : ''
  const fraseAbiertos = abiertos
    .map(
      (fila) =>
        ` ${fila.anyo} no ha terminado y ya lleva ${entero(fila.calor)} días de calor.`,
    )
    .join('')
  const fraseMarca = abiertos.length ? ' El asterisco marca un año incompleto.' : ''

  destroyChart()
  resultsEl.innerHTML = `
    <div class="chart-header">
      <h2>Días de calor y de helada</h2>
      <p class="chart-summary">
        En toda la serie hay ${entero(suma('calor'))} días con máxima de 30 °C o más;
        ${entero(suma('calor_fuerte'))} de ellos llegan a 35 °C.
        Hay ${entero(suma('helada'))} días con mínima de 0 °C o menos.${fraseCompletos}${fraseAbiertos}${fraseMarca}
      </p>
    </div>
    <div class="chart-wrap">
      <canvas id="temp-chart" aria-label="Días de calor y de helada por año"></canvas>
    </div>
  `

  const serie = (label, clave, color) => ({
    label,
    data: filas.map((fila) => fila[clave]),
    backgroundColor: color,
    borderWidth: 0,
  })

  montarGrafica(document.querySelector('#temp-chart'), {
    type: 'bar',
    data: {
      labels: filas.map((fila) => (fila.meses < 12 ? `${fila.anyo}*` : String(fila.anyo))),
      datasets: [
        serie('≥ 30 °C', 'calor', '#c45c26'),
        serie('≥ 35 °C', 'calor_fuerte', '#8c2f2f'),
        serie('≤ 0 °C', 'helada', '#0f6e8c'),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#1a2b33' } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${item.parsed.y.toLocaleString('es-ES')} días`,
          },
        },
      },
      scales: {
        x: { ...EJE, title: { ...EJE.title, display: true, text: 'Año' } },
        y: {
          ...EJE,
          beginAtZero: true,
          ticks: { ...EJE.ticks, precision: 0 },
          title: { ...EJE.title, display: true, text: 'Días' },
        },
      },
    },
  })
}

async function start() {
  try {
    const { initDb, countRows } = await import('./db.js')
    const {
      aniosDisponibles,
      anioTipo,
      diaTipo,
      diasCalorHelada,
      episodiosLluvia,
      recordsSerie,
      temperaturaMesTodosAnios,
      tempsMaximasMesAnio,
    } = await import('./queries.js')

    await initDb()
    const [n, anios, records, anio, dia, calorHelada, episodios] = await Promise.all([
      countRows(),
      aniosDisponibles(),
      recordsSerie(),
      anioTipo(),
      diaTipo(),
      diasCalorHelada(),
      episodiosLluvia(),
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
      maximasFiltersEl.hidden = vista !== 'maximas' && vista !== 'mes-anios'
      resultsEl.innerHTML = `<p class="empty">Consultando…</p>`
      destroyChart()

      try {
        if (vista === 'anio-temp') {
          if (token !== solicitud) return
          renderAnioTemperatura(anio)
          return
        }
        if (vista === 'dia-tipo') {
          if (token !== solicitud) return
          renderDiaTipo(dia)
          return
        }
        if (vista === 'calor-helada') {
          if (token !== solicitud) return
          renderCalorHelada(calorHelada)
          return
        }
        if (vista === 'anio-lluvia') {
          if (token !== solicitud) return
          renderAnioLluvia(anio)
          return
        }
        if (vista === 'episodios') {
          if (token !== solicitud) return
          renderEpisodiosLluvia(episodios)
          return
        }

        const mes = Number(monthEl.value)
        const anyo = Number(yearEl.value)
        if (vista === 'mes-anios') {
          const rows = await temperaturaMesTodosAnios(mes)
          if (token !== solicitud) return
          renderMesFrenteAnios(rows, mes, anyo)
          return
        }

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
