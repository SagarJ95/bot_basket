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
        type: Sequelize.STRING
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
      device:{
        type: Sequelize.STRING
      },
      browers:{
        type: Sequelize.STRING
      },
      ip_address:{
        type: Sequelize.STRING
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