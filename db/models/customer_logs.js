"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const customer_logs = sequelize.define(
  "customer_logs",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    customer_id: {
      type: DataTypes.INTEGER
    },
    login_time: {
      type: DataTypes.DATE
    },
    logout_time: {
      type: DataTypes.STRING
    },
    device: {
      type: DataTypes.STRING
    },
    browers: {
      type: DataTypes.STRING
    },
    ip_address:{
      type: DataTypes.STRING
    },
    token: {
      type: DataTypes.STRING
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE
    },
    deleted_at: {
      type: DataTypes.DATE
    }
  },
  {
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    modelName: "customer_logs",
  }
);

export default customer_logs;
