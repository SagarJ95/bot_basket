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
      phone_no: {
        type: Sequelize.STRING
      },
      whatsapp_no:{
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      password: {
        type: Sequelize.STRING
      },
      profile:{
        type:Sequelize.STRING
      },
      enable_whatsapp_notification: {
        type: Sequelize.ENUM('0', '1')
      },
      enable_email_notification: {
        type: Sequelize.ENUM('0', '1')
      },
      status: {
        type: Sequelize.ENUM('0', '1')
      },
      created_by:{
        type:Sequelize.INTEGER
      },
      updated_by:{
        type:Sequelize.INTEGER
      },
      deleted_by:{
        type:Sequelize.INTEGER
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