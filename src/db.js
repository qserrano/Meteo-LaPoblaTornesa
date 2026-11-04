import * as duckdb from '@duckdb/duckdb-wasm'
import duckdbWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdbWasmEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import csvUrl from '../data/CLIMATOLOGICALDATA.csv?url'

const BUNDLES = {
  mvp: {
    mainModule: duckdbWasm,
    mainWorker: mvpWorker,
  },
  eh: {
    mainModule: duckdbWasmEh,
    mainWorker: ehWorker,
  },
}

let db = null
let conn = null
let initPromise = null

function absoluteUrl(path) {
  return new URL(path, window.location.origin).href
}

async function createDb() {
  const bundle = await duckdb.selectBundle(BUNDLES)
  const worker = new Worker(absoluteUrl(bundle.mainWorker))
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
  const instance = new duckdb.AsyncDuckDB(logger, worker)
  await instance.instantiate(
    absoluteUrl(bundle.mainModule),
    bundle.pthreadWorker ? absoluteUrl(bundle.pthreadWorker) : undefined,
  )
  return instance
}

export async function initDb() {
  if (conn) return { db, conn }
  if (initPromise) return initPromise

  initPromise = (async () => {
    db = await createDb()

    const response = await fetch(absoluteUrl(csvUrl))
    if (!response.ok) {
      throw new Error(`No se pudo cargar el CSV (${response.status})`)
    }
    const buffer = new Uint8Array(await response.arrayBuffer())
    await db.registerFileBuffer('CLIMATOLOGICALDATA.csv', buffer)

    conn = await db.connect()
    await conn.query(`
      CREATE OR REPLACE TABLE clima AS
      SELECT
        strptime(DAY, '%d/%m/%y')::DATE AS day,
        TRY_CAST(replace(MEAN_TEMP, ',', '.') AS DOUBLE) AS mean_temp,
        TRY_CAST(replace(HIGH_TEMP, ',', '.') AS DOUBLE) AS high_temp,
        TRY_CAST(replace(LOW_TEMP, ',', '.') AS DOUBLE) AS low_temp,
        TRY_CAST(replace(RAIN, ',', '.') AS DOUBLE) AS rain,
        TRY_CAST(replace(MEAN_HUMID, ',', '.') AS DOUBLE) AS mean_humid,
        TRY_CAST(replace(AVG_WIND_SPEED, ',', '.') AS DOUBLE) AS avg_wind_speed,
        TRY_CAST(replace(MEAN_BAROM, ',', '.') AS DOUBLE) AS mean_barom
      FROM read_csv('CLIMATOLOGICALDATA.csv', header = true, all_varchar = true)
    `)

    return { db, conn }
  })()

  try {
    return await initPromise
  } catch (error) {
    initPromise = null
    db = null
    conn = null
    throw error
  }
}

export function getConnection() {
  if (!conn) throw new Error('DuckDB aún no está inicializado')
  return conn
}

export async function countRows() {
  const result = await getConnection().query('SELECT count(*)::INTEGER AS n FROM clima')
  return Number(result.toArray()[0].n)
}
