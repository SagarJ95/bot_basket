"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const store_self_location = sequelize.define(
  "store_self_location",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    store_name: {
      type: DataTypes.STRING,
    },
    store_address: {
      type: DataTypes.TEXT,
    },
    store_pincode: {
      type: DataTypes.INTEGER,
    },

    store_late: {
      type: DataTypes.FLOAT,
    },
    store_long: {
      type: DataTypes.FLOAT,
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
    deleted_by: {
      type: DataTypes.INTEGER,
    },
  },
  {
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    modelName: "store_self_location",
  }
);

export default store_self_location;
