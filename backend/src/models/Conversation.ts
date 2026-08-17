import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../config/database.js'

/** 会话模型：一个用户拥有多个会话 */
export class Conversation extends Model {
  declare id: string
  declare userId: string
  declare title: string
  declare createdAt: Date
  declare updatedAt: Date
}

Conversation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    title: {
      type: DataTypes.STRING(256),
      allowNull: false,
      defaultValue: '新对话',
    },
  },
  {
    sequelize,
    modelName: 'Conversation',
    tableName: 'conversations',
    underscored: true,
  },
)
