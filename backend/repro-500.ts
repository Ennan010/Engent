/**
 * 临时复现脚本：直接调用 createMessage，打印真实错误堆栈
 */
import { sequelize } from './config/database.js'
import { User, Conversation, Message } from './src/models/index.js'
import { createMessage } from './src/controllers/messageController.js'

async function main() {
  await sequelize.authenticate()
  console.log('[db] connected')

  const userId = `test-user-${Date.now()}`
  await User.findOrCreate({ where: { id: userId } })
  const conversation = await Conversation.create({ userId, title: '新对话' })

  const req = {
    userId,
    params: { conversationId: conversation.id },
    body: { content: '你好，请简单介绍一下你自己' },
  } as never

  let statusCode = 200
  const res = {
    status(code: number) {
      statusCode = code
      return this
    },
    json(data: unknown) {
      console.log(`[res] status=${statusCode}`)
      console.log('[res] body keys:', Object.keys(data as object))
      return this
    },
  } as never

  const next = (err: unknown) => {
    console.error('[next] 捕获到错误:', err)
    if (err instanceof Error && err.stack) {
      console.error('[stack]', err.stack)
    }
    process.exitCode = 1
  }

  await createMessage(req as never, res as never, next as never)
  console.log('[done] status=', statusCode)

  // 清理测试数据
  await Message.destroy({ where: { conversationId: conversation.id } })
  await Conversation.destroy({ where: { id: conversation.id } })
  await User.destroy({ where: { id: userId } })
  await sequelize.close()
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
