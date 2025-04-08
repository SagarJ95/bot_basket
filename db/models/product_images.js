"use strict";
import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const product_images = sequelize.define(
  "product_images",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    product_id: {
        type: DataTypes.INTEGER
    },
    image_path: {
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
    modelName: "product_images",
  }
);

export default product_images;
