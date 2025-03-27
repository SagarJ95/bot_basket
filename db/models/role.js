"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const role = sequelize.define(
  "role",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    role_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: "Name cannot be null",
        },
        notEmpty: {
          msg: "Name cannot be empty",
        },
      },
    },
    permission_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    created_by:{
        type: DataTypes.INTEGER,
    },
    updated_by:{
        type: DataTypes.INTEGER,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    modelName: "role",
  }
);

export default role;
