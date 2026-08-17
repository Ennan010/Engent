import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Sequelize } from 'sequelize'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const databaseUrl = process.env.DATABASE_URL ?? ''

/** 是否使用 PostgreSQL（DATABASE_URL 以 postgres:// 或 postgresql:// 开头） */
export const isPostgres = /^postgres(ql)?:\/\//.test(databaseUrl)

/** 默认 SQLite 文件路径：backend/data/engent.sqlite */
const defaultSqlitePath = path.resolve(__dirname, '../data/engent.sqlite')

function resolveSqlitePath(): string {
  const storage = process.env.SQLITE_PATH
    ? path.resolve(process.cwd(), process.env.SQLITE_PATH)
    : defaultSqlitePath
  fs.mkdirSync(path.dirname(storage), { recursive: true })
  return storage
}

/**
 * Sequelize 实例：
 * - 默认 SQLite（零运维，单文件存储）
 * - 将 DATABASE_URL 改为 postgres:// 开头即可切换 PostgreSQL，其余代码无需改动
 */
export const sequelize = isPostgres
  ? new Sequelize(databaseUrl, {
      logging: false,
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: resolveSqlitePath(),
      logging: false,
    })

/**
 * 对 SQLite 唯一连接执行连接级 PRAGMA（需在应用启动时、首次业务查询前调用）。
 *
 * 注意：Sequelize 的 sqlite 方言在 getConnection 中直接缓存复用唯一连接，
 * 完全绕过连接池与 afterConnect 钩子，因此 PRAGMA 无法通过钩子自动设置，
 * 必须由启动流程显式执行。
 *
 * - journal_mode=WAL：读写并发不互斥，显著减少 "database is locked"
 * - busy_timeout=5000：写冲突时等待 5s 而非立即抛 SQLITE_BUSY
 * - synchronous=NORMAL：WAL 下推荐的持久化级别，写入更快
 */
export async function ensureSqlitePragmas(): Promise<void> {
  if (isPostgres) return
  await sequelize.query('PRAGMA journal_mode = WAL')
  await sequelize.query('PRAGMA busy_timeout = 5000')
  await sequelize.query('PRAGMA synchronous = NORMAL')
}
