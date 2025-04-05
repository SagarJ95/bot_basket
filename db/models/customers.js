"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const customers = sequelize.define(
  "customers",
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
    whatsapp_no:{
      type: DataTypes.STRING
    },
    profile:{
        type:DataTypes.STRING,
        allowNull:true,
    },
    password: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.ENUM('0', '1')
    },
    enable_whatsapp_notification: {
      type: DataTypes.ENUM('0', '1')
    },
    enable_email_notification: {
      type: DataTypes.ENUM('0', '1')
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
    modelName: "customers",
  }
);

export default customers;
