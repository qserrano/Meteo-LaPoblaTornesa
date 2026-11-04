import { initDb, getConnection } from './db.js'

function assertMes(mes) {
  const month = Number(mes)
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('El mes debe ser un entero entre 1 y 12')
  }
  return month
}

function assertAnio(anyo) {
  const year = Number(anyo)
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error('El año no es válido')
  }
  return year
}

/**
 * Extremos de toda la serie: día más cálido, más frío y más lluvioso.
 * Si hay empate, devuelve todas las fechas.
 */
export async function recordsSerie() {
  await initDb()
  const result = await getConnection().query(`
    WITH extremos AS (
      SELECT
        max(high_temp) AS max_high,
        min(low_temp) AS min_low,
        max(rain) AS max_rain
      FROM clima
    )
    SELECT
      'calor' AS tipo,
      year(day)::INTEGER AS anyo,
      month(day)::INTEGER AS mes,
      day(day)::INTEGER AS dia,
      round(high_temp, 1) AS valor
    FROM clima, extremos
    WHERE high_temp = max_high
    UNION ALL
    SELECT
      'frio',
      year(day)::INTEGER,
      month(day)::INTEGER,
      day(day)::INTEGER,
      round(low_temp, 1)
    FROM clima, extremos
    WHERE low_temp = min_low
    UNION ALL
    SELECT
      'lluvia',
      year(day)::INTEGER,
      month(day)::INTEGER,
      day(day)::INTEGER,
      round(rain, 1)
    FROM clima, extremos
    WHERE rain = max_rain
  `)

  const grupos = { calor: [], frio: [], lluvia: [] }
  for (const row of result.toArray()) {
    const tipo = String(row.tipo)
    if (!grupos[tipo]) continue
    grupos[tipo].push({
      anyo: Number(row.anyo),
      mes: Number(row.mes),
      dia: Number(row.dia),
      valor: Number(row.valor),
    })
  }

  for (const fechas of Object.values(grupos)) {
    fechas.sort((a, b) => a.anyo - b.anyo || a.mes - b.mes || a.dia - b.dia)
  }

  return grupos
}

/** Años presentes en la serie (para el selector). */
export async function aniosDisponibles() {
  await initDb()
  const result = await getConnection().query(`
    SELECT DISTINCT year(day)::INTEGER AS anyo
    FROM clima
    ORDER BY anyo
  `)
  return result.toArray().map((row) => Number(row.anyo))
}

/**
 * Consulta 1: temperatura de un mes concreto en todos los años.
 * Devuelve media, máxima y mínima por año para el mes indicado (1–12).
 */
export async function temperaturaMesTodosAnios(mes) {
  const month = assertMes(mes)

  await initDb()
  const result = await getConnection().query(`
    SELECT
      year(day) AS anyo,
      round(avg(mean_temp), 1) AS temp_media,
      round(max(high_temp), 1) AS temp_max,
      round(min(low_temp), 1) AS temp_min,
      count(*)::INTEGER AS dias
    FROM clima
    WHERE month(day) = ${month}
    GROUP BY year(day)
    ORDER BY anyo
  `)

  return result.toArray().map((row) => ({
    anyo: Number(row.anyo),
    temp_media: Number(row.temp_media),
    temp_max: Number(row.temp_max),
    temp_min: Number(row.temp_min),
    dias: Number(row.dias),
  }))
}

/**
 * Temperaturas máximas diarias de un mes y año concretos.
 */
export async function tempsMaximasMesAnio(mes, anyo) {
  const month = assertMes(mes)
  const year = assertAnio(anyo)

  await initDb()
  const result = await getConnection().query(`
    SELECT
      day(day)::INTEGER AS dia,
      round(high_temp, 1) AS temp_max
    FROM clima
    WHERE year(day) = ${year}
      AND month(day) = ${month}
    ORDER BY day
  `)

  return result.toArray().map((row) => ({
    dia: Number(row.dia),
    temp_max: Number(row.temp_max),
  }))
}
