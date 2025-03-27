"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const customer = sequelize.define(
  "customer",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    first_name: {
      type: DataTypes.STRING
    },
    last_name: {
      type: DataTypes.STRING
    },
    email: {
      type: DataTypes.STRING
    },
    phone_no: {
      type: DataTypes.STRING
    },
    password: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.ENUM('0', '1')
    },
    country:{
      type: DataTypes.STRING,
    },
    google_token:{
      type: DataTypes.STRING
    },
    google_refresh_token:{
      type: DataTypes.STRING
    },
    apple_id:{
      type: DataTypes.STRING
    },
    apple_token:{
      type: DataTypes.STRING
    },
    apple_refresh_token:{
      type: DataTypes.STRING
    },
    category_id:{
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
    modelName: "customer",
  }
);

export default customer;
