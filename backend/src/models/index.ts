import { User } from './User.js'
import { Conversation } from './Conversation.js'
import { Message } from './Message.js'
import { Document } from './Document.js'
import { DocumentChunk } from './DocumentChunk.js'
import { ChunkVector } from './ChunkVector.js'

// 集中建立模型关联（模块顶层执行，确保在 sequelize 上注册）

User.hasMany(Conversation, {
  foreignKey: 'userId',
  as: 'conversations',
  onDelete: 'CASCADE',
})
Conversation.belongsTo(User, { foreignKey: 'userId', as: 'user' })

Conversation.hasMany(Message, {
  foreignKey: 'conversationId',
  as: 'messages',
  onDelete: 'CASCADE',
})
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation' })

// 知识库：文档 → 分块 → 向量
User.hasMany(Document, {
  foreignKey: 'userId',
  as: 'documents',
  onDelete: 'CASCADE',
})
Document.belongsTo(User, { foreignKey: 'userId', as: 'user' })

Document.hasMany(DocumentChunk, {
  foreignKey: 'documentId',
  as: 'chunks',
  onDelete: 'CASCADE',
})
DocumentChunk.belongsTo(Document, { foreignKey: 'documentId', as: 'document' })

Document.hasMany(ChunkVector, {
  foreignKey: 'documentId',
  as: 'vectors',
  onDelete: 'CASCADE',
})
ChunkVector.belongsTo(Document, { foreignKey: 'documentId', as: 'document' })

export { User, Conversation, Message, Document, DocumentChunk, ChunkVector }
