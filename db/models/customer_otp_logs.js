"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const customer_otp_logs = sequelize.define(
  "customer_otp_logs",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    email: {
      type: DataTypes.STRING
    },
    otp: {
      type: DataTypes.INTEGER
    },
    expires_at:{
      type: DataTypes.DATE
    },
    status: {
      type: DataTypes.ENUM('0', '1')
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
    modelName: "customer_otp_logs",
  }
);

export default customer_otp_logs;
