"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const delivery_option = sequelize.define(
  "delivery_option",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    delivery_option_name: {
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
    modelName: "delivery_option",
  }
);

export default delivery_option;
