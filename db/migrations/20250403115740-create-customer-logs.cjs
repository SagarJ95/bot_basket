'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customer_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      customer_id: {
        type: Sequelize.INTEGER
      },
      login_time:{
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    logout_time:{
      allowNull: true,
      type: Sequelize.DATE
    },
    token:{
      type: Sequelize.STRING
    },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customer_logs');
  }
};