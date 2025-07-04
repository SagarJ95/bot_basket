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
      type: DataTypes.INTEGER,
    },
    customer_id: {
      type: DataTypes.BIGINT,
    },
    full_name: {
      type: DataTypes.STRING,
    },
    mobile_number: {
      type: DataTypes.STRING,
    },
    phone_country_code: {
      type: DataTypes.STRING,
    },
    address1: {
      type: DataTypes.TEXT,
    },
    address2: {
      type: DataTypes.TEXT,
    },
    zip_code: {
      type: DataTypes.INTEGER,
    },
    country: {
      type: DataTypes.STRING,
    },
    city: {
      type: DataTypes.STRING,
    },
    state: {
      type: DataTypes.STRING,
    },
    zip_code: {
      type: DataTypes.INTEGER,
    },
    tag: {
      type: DataTypes.STRING,
    },
    status: {
      defaultValue: 1,
      type: DataTypes.INTEGER,
    },

    created_by: {
      type: DataTypes.INTEGER,
    },
    updated_by: {
      type: DataTypes.INTEGER,
    },
    deleted_by: {
      type: DataTypes.INTEGER,
    },
    created_at: {
      // allowNull: false,
      type: DataTypes.DATE,
      // defaultValue: now(),
    },
    updated_at: {
      // allowNull: false,
      type: DataTypes.DATE,
      // defaultValue: now(),
    },
    deleted_at: {
      type: DataTypes.DATE,
    },
  },
  {
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    modelName: "customer_address",
  }
);

export default customer_address;
