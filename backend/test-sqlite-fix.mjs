// 临时验证脚本：确认 WAL/busy_timeout PRAGMA 生效 + bulkCreate updateOnDuplicate 幂等覆盖，用完即删
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
for (const [k, v] of Object.entries(parse(readFileSync('.env', 'utf-8')))) {
  process.env[k] = v
}

const { sequelize, ensureSqlitePragmas } = await import('./config/database.ts')
const { User, Document, ChunkVector } = await import('./src/models/index.ts')
const { decodeVector } = await import('./src/services/vectorStore.ts')

// 1) 启动流程应执行的 PRAGMA
await ensureSqlitePragmas()
const [row] = await sequelize.query('PRAGMA journal_mode')
console.log('[1] journal_mode =', row?.[0]?.journal_mode, '(期望 wal)')
const [busy] = await sequelize.query('SELECT * FROM pragma_busy_timeout')
console.log('[2] busy_timeout 原始行 =', JSON.stringify(busy?.[0]), '(期望 busy_timeout=5000)')

// 2) 建完整外键链：User → Document
const uid = '00000000-0000-0000-0000-000000000000'
const user = await User.create({ id: uid, nickname: 'sqlite-fix-test' })
const doc = await Document.create({
  userId: uid,
  name: 'sqlite-fix-test-doc',
  type: 'txt',
  size: 0,
  chunkCount: 0,
  status: 'processing',
})

try {
  // 3) bulkCreate 批量插入（一次 INSERT，模拟 insertVectors 新实现）
  const chunkId = 'sqlite-fix-test-' + Date.now()
  await ChunkVector.bulkCreate([
    { id: chunkId, userId: uid, documentId: doc.id, embedding: Buffer.from(new Float32Array([1, 2, 3]).buffer) },
  ])
  const first = await ChunkVector.findByPk(chunkId)
  console.log('[3] bulkCreate 批量插入成功:', Boolean(first), '首元素 =', first ? decodeVector(first.embedding)[0] : null)

  // 4) updateOnDuplicate 幂等覆盖（模拟重传/覆盖场景）
  await ChunkVector.bulkCreate(
    [{ id: chunkId, userId: uid, documentId: doc.id, embedding: Buffer.from(new Float32Array([9, 9, 9]).buffer) }],
    { updateOnDuplicate: ['embedding', 'updatedAt'] },
  )
  const second = await ChunkVector.findByPk(chunkId)
  const val = second ? decodeVector(second.embedding)[0] : null
  console.log('[4] updateOnDuplicate 幂等覆盖成功:', val === 9, '(值 =', val, ')')

  await ChunkVector.destroy({ where: { id: chunkId } })
} finally {
  await doc.destroy()
  await user.destroy()
}

console.log('[5] 测试数据已清理')
await sequelize.close()
