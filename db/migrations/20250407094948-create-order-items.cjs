'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_items', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      order_id: {
        type: Sequelize.BIGINT
      },
      customer_id: {
        type: Sequelize.BIGINT
      },
      cart_id: {
        type: Sequelize.BIGINT
      },
      product_id: {
        type: Sequelize.BIGINT
      },
      product_name: {
        type: Sequelize.STRING
      },
      quantity: {
        type: Sequelize.INTEGER
      },
      price: {
        type: Sequelize.STRING
      },
      order_item_status: {
        type: Sequelize.INTEGER
      },
      item_delivery_status: {
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
    await queryInterface.dropTable('order_items');
  }
};