"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const products = sequelize.define(
  "products",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    ordering : {
      type: DataTypes.INTEGER
    },
    name: {
      type: DataTypes.STRING
    },
    country_id:{
      type: DataTypes.INTEGER
    },
    description: {
        type: DataTypes.STRING
    },
    category: {
        type: DataTypes.INTEGER
    },
    minimum_order_place: {
        type: DataTypes.INTEGER
    },
    maximum_order_place: {
        type: DataTypes.INTEGER
    },
    price: {
        type: DataTypes.INTEGER
    },
    slug: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue:1
    },
    thumbnail_product_image:{
        type: DataTypes.STRING
    },
    product_stock_status: {
        type: DataTypes.INTEGER,
        defaultValue:1
    },
    created_by: {
      type: DataTypes.INTEGER
    },
    updated_by: {
      type: DataTypes.INTEGER
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
    modelName: "products",
  }
);

export default products;
