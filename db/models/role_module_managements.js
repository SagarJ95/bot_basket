"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const role_module_managements = sequelize.define(
  "role_module_managements",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    module: {
      type: DataTypes.STRING,
    },
    sub_module: {
      type: DataTypes.STRING,
    },
    permission: {
      type: DataTypes.STRING,
    },
    routes: {
      type: DataTypes.STRING,
    },
    module_slug: {
      type: DataTypes.STRING,
    },
    submodule_slug: {
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
    modelName: "role_module_managements",
  }
);

export default role_module_managements;
