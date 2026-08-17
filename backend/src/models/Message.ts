import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../config/database.js'

export type MessageRole = 'user' | 'assistant'

/** 消息模型：一条会话包含多条消息 */
export class Message extends Model {
  declare id: string
  declare conversationId: string
  declare role: MessageRole
  declare content: string
  declare createdAt: Date
  declare updatedAt: Date
}

Message.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversationId: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.ENUM('user', 'assistant'), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    underscored: true,
  },
)
