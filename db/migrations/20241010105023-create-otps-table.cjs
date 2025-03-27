'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('otps', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      contact: {
        type: Sequelize.STRING,
        allowNull: false
      },
      otp: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('0', '1'), // Enum for status
        defaultValue: '1',  // Default status to '1'
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('otps');
  }
};
