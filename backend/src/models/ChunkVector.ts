import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../config/database.js'

/**
 * 分块向量模型（路径 A：普通表 + BLOB 存储 + JS 余弦相似度）
 *
 * id 与 document_chunks.id 一一对应（一个分块一个向量），
 * embedding 存储 Float32Array 的二进制缓冲（float32 小端序）。
 * 规模在十万级以内时，全量加载 + JS 余弦检索毫秒级完成，无需引入原生扩展。
 */
export class ChunkVector extends Model {
  declare id: string
  declare userId: string
  declare documentId: string
  declare embedding: Buffer
  declare createdAt: Date
  declare updatedAt: Date
}

ChunkVector.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    documentId: { type: DataTypes.UUID, allowNull: false },
    embedding: { type: DataTypes.BLOB, allowNull: false },
  },
  {
    sequelize,
    modelName: 'ChunkVector',
    tableName: 'chunk_vectors',
    underscored: true,
  },
)
