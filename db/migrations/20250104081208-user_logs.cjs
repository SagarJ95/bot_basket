'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id:{
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      role_id:{
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      ip_address:{
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_logs');
  }
};