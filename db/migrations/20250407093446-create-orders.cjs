'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      customer_id: {
            type: Sequelize.BIGINT
      },
      customer_name: {
        type: Sequelize.STRING
      },
      whatsapp_number: {
        type: Sequelize.BIGINT
      },
      email: {
        type: Sequelize.STRING
      },
      perferred_delivery_date: {
        type: Sequelize.DATE
      },
      address: {
        type: Sequelize.INTEGER
      },
      special_instruction: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.INTEGER
      },
      created_by:{
        type:Sequelize.INTEGER,
      },
      updated_by:{
        type:Sequelize.INTEGER,
      },
      deleted_by:{
        type:Sequelize.INTEGER,
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
    await queryInterface.dropTable('orders');
  }
};