"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const customer_address = sequelize.define(
  "customer_address",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    customer_id: {
      type: DataTypes.BIGINT
    },
    address: {
      type: DataTypes.TEXT
    },
    status: {
      type: DataTypes.INTEGER
    },
    tag: {
      type: DataTypes.STRING
    },
    created_by:{
      type:DataTypes.INTEGER,
    },
    updated_by:{
      type:DataTypes.INTEGER,
    },
    deleted_by:{
      type:DataTypes.INTEGER,
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
    modelName: "customer_address",
  }
);

export default customer_address;
