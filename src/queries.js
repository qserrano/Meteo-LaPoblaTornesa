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

/**
 * Año tipo: media mensual de los años completos.
 * Cada año pesa igual. El año en curso, si está incompleto, queda fuera.
 */
export async function anioTipo() {
  await initDb()
  const result = await getConnection().query(`
    WITH completos AS (
      SELECT year(day) AS anyo
      FROM clima
      GROUP BY 1
      HAVING count(DISTINCT month(day)) = 12
    ),
    mensuales AS (
      SELECT
        year(day) AS anyo,
        month(day) AS mes,
        avg(high_temp) AS temp_max,
        avg(mean_temp) AS temp_media,
        avg(low_temp) AS temp_min,
        sum(rain) AS lluvia
      FROM clima
      WHERE year(day) IN (SELECT anyo FROM completos)
      GROUP BY 1, 2
    )
    SELECT
      mes::INTEGER AS mes,
      round(avg(temp_max), 1) AS temp_max,
      round(avg(temp_media), 1) AS temp_media,
      round(avg(temp_min), 1) AS temp_min,
      round(avg(lluvia), 1) AS lluvia,
      (SELECT min(anyo)::INTEGER FROM completos) AS desde,
      (SELECT max(anyo)::INTEGER FROM completos) AS hasta
    FROM mensuales
    GROUP BY mes
    ORDER BY mes
  `)

  const filas = result.toArray().map((row) => ({
    mes: Number(row.mes),
    temp_max: Number(row.temp_max),
    temp_media: Number(row.temp_media),
    temp_min: Number(row.temp_min),
    lluvia: Number(row.lluvia),
    desde: Number(row.desde),
    hasta: Number(row.hasta),
  }))

  return {
    desde: filas[0]?.desde ?? null,
    hasta: filas[0]?.hasta ?? null,
    meses: filas,
  }
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
      year(day)::INTEGER AS anyo,
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
 * Episodios de lluvia: rachas de días seguidos con al menos `umbralRacha` mm
 * que incluyen algún día de `umbralPico` mm o más.
 */
export async function episodiosLluvia() {
  const umbralRacha = 1
  const umbralPico = 50

  await initDb()
  const conn = getConnection()
  const totalResult = await conn.query(`SELECT round(sum(rain), 1) AS total FROM clima`)
  const episodiosResult = await conn.query(`
      WITH mojados AS (
        SELECT
          day,
          rain,
          lag(day) OVER (ORDER BY day) AS prev
        FROM clima
        WHERE rain >= ${umbralRacha}
      ),
      marcados AS (
        SELECT
          day,
          rain,
          CASE
            WHEN prev IS NULL OR day > prev + INTERVAL 1 DAY THEN 1
            ELSE 0
          END AS corte
        FROM mojados
      ),
      grupos AS (
        SELECT
          day,
          rain,
          sum(corte) OVER (ORDER BY day) AS grupo
        FROM marcados
      )
      SELECT
        year(min(day))::INTEGER AS anyo_ini,
        month(min(day))::INTEGER AS mes_ini,
        day(min(day))::INTEGER AS dia_ini,
        year(max(day))::INTEGER AS anyo_fin,
        month(max(day))::INTEGER AS mes_fin,
        day(max(day))::INTEGER AS dia_fin,
        count(*)::INTEGER AS dias,
        round(sum(rain), 1) AS lluvia,
        round(max(rain), 1) AS pico
      FROM grupos
      GROUP BY grupo
      HAVING max(rain) >= ${umbralPico}
      ORDER BY min(day)
    `)

  const fecha = (row, suffix) => ({
    anyo: Number(row[`anyo_${suffix}`]),
    mes: Number(row[`mes_${suffix}`]),
    dia: Number(row[`dia_${suffix}`]),
  })

  return {
    total: Number(totalResult.toArray()[0].total),
    umbralRacha,
    umbralPico,
    episodios: episodiosResult.toArray().map((row) => ({
      inicio: fecha(row, 'ini'),
      fin: fecha(row, 'fin'),
      dias: Number(row.dias),
      lluvia: Number(row.lluvia),
      pico: Number(row.pico),
    })),
  }
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
