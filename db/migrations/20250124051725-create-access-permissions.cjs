"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("access_permissions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      access_name: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.ENUM("0", "1"),
      },
      created_by: {
        type: Sequelize.INTEGER,
      },
      updated_by: {
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
    await queryInterface.dropTable("access_permissions");
  },
};
