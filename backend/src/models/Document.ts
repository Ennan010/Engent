import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../config/database.js'

export type DocumentStatus = 'processing' | 'ready' | 'failed'

/** 知识库文档模型：记录一次上传的文档及其处理状态 */
export class Document extends Model {
  declare id: string
  declare userId: string
  declare name: string
  declare type: string
  declare size: number
  declare chunkCount: number
  declare status: DocumentStatus
  declare error: string | null
  declare createdAt: Date
  declare updatedAt: Date
}

Document.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    type: { type: DataTypes.STRING(20), allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    chunkCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('processing', 'ready', 'failed'),
      allowNull: false,
      defaultValue: 'processing',
    },
    error: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Document',
    tableName: 'documents',
    underscored: true,
  },
)
