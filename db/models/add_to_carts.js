"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const addTocarts = sequelize.define(
  "add_to_carts",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    product_id: {
      type: DataTypes.BIGINT
    },
    qty: {
      type: DataTypes.BIGINT
    },
    price: {
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
    modelName: "add_to_carts",
  }
);

export default addTocarts;
