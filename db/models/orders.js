"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const orders = sequelize.define(
  "orders",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    order_ref_id: {
      type: DataTypes.STRING
    },
    customer_id: {
      type: DataTypes.BIGINT
    },
    customer_name: {
      type: DataTypes.STRING
    },
    whatsapp_number: {
      type: DataTypes.BIGINT
    },
    email: {
      type: DataTypes.STRING
    },
    perferred_delivery_date: {
      type: DataTypes.DATE
    },
    delivery_date:{
      type: DataTypes.DATE
    },
    payment_status:{
      type: DataTypes.INTEGER
    },
    payment_mode:{
      type: DataTypes.STRING
    },
    address: {
      type: DataTypes.INTEGER
    },
    special_instruction: {
      type: DataTypes.STRING
    },
    invoice_path:{
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.INTEGER
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
    modelName: "orders",
  }
);

export default orders;
