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
