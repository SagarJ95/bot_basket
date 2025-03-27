'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      first_name: {
        type: Sequelize.STRING
      },
      last_name: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      phone_no: {
        type: Sequelize.STRING
      },
      password: {
        type: Sequelize.STRING
      },
      country:{
        type: Sequelize.STRING,
      },
      google_token: {
        type: Sequelize.STRING
      },
      google_refresh_token: {
        type: Sequelize.STRING
      },
      apple_id:{
        type:Sequelize.STRING
      },
      apple_token:{
        type:Sequelize.STRING
      },
      apple_refresh_token:{
        type:Sequelize.STRING
      },
      status: {
        type: Sequelize.ENUM('0', '1')
      },
      category_id:{
        type:Sequelize.STRING
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deleted_at: {
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customers');
  }
};