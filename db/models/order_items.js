"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const order_items = sequelize.define(
  "order_items",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    order_id: {
      type: DataTypes.BIGINT
    },
    customer_id: {
      type: DataTypes.BIGINT
    },
    cart_id: {
      type: DataTypes.BIGINT
    },
    product_id: {
      type: DataTypes.BIGINT
    },
    product_name: {
      type: DataTypes.STRING
    },
    quantity: {
      type: DataTypes.INTEGER
    },
    price: {
      type: DataTypes.STRING
    },
    order_item_status: {
      type: DataTypes.INTEGER
    },
    item_delivery_status: {
      type: DataTypes.INTEGER
    },
    reason: {
      type: DataTypes.TEXT
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
    modelName: "order_items",
  }
);

export default order_items;
