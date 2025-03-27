"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const access_permission = sequelize.define(
  "access_permission",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    access_name: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.ENUM("0", "1"),
    },
    created_by: {
      type: DataTypes.INTEGER,
    },
    updated_by: {
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
    modelName: "access_permissions",
  }
);

export default access_permission;
