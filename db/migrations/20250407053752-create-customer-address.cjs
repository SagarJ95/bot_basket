"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("customer_addresses", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      customer_id: {
        type: Sequelize.BIGINT,
      },
      full_name: {
        type: Sequelize.STRING,
      },
      mobile_number: {
        type: Sequelize.STRING,
      },
      address1: {
        type: Sequelize.TEXT,
      },
      address2: {
        type: Sequelize.TEXT,
      },
      zip_code: {
        type: Sequelize.INTEGER,
      },
      contry: {
        type: Sequelize.STRING,
      },
      city: {
        type: Sequelize.STRING,
      },
      state: {
        type: Sequelize.STRING,
      },
      zip_code: {
        type: Sequelize.INTEGER,
      },
      tag: {
        type: Sequelize.STRING,
      },
      status: {
        defaultValue: 1,
        type: Sequelize.INTEGER,
      },
      created_by: {
        type: Sequelize.INTEGER,
      },
      updated_by: {
        type: Sequelize.INTEGER,
      },
      deleted_by: {
        type: Sequelize.INTEGER,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deleted_at: {
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("customer_addresses");
  },
};
