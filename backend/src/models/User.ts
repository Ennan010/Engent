import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../config/database.js'

/**
 * 用户模型
 * 主键 id 即 Authing 的 sub（用户唯一标识），不存储任何认证信息
 */
export class User extends Model {
  declare id: string
  declare nickname: string | null
  declare avatarUrl: string | null
  declare createdAt: Date
  declare updatedAt: Date
}

User.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      comment: 'Authing sub（用户唯一标识）',
    },
    nickname: { type: DataTypes.STRING(128), allowNull: true },
    avatarUrl: { type: DataTypes.STRING(512), allowNull: true },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
  },
)
