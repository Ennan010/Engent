import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../config/database.js'

/** 文档分块模型：文档被切分后的每个文本块，作为向量化的最小单元 */
export class DocumentChunk extends Model {
  declare id: string
  declare documentId: string
  declare userId: string
  declare seq: number
  declare content: string
  declare createdAt: Date
  declare updatedAt: Date
}

DocumentChunk.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    documentId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    seq: { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    modelName: 'DocumentChunk',
    tableName: 'document_chunks',
    underscored: true,
  },
)
