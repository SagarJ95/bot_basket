const bcrypt = require("bcrypt");

module.exports = {
  up: (queryInterface, Sequelize) => {
    let password = process.env.ADMIN_PASSWORD;
    const hashPassword = bcrypt.hashSync(password, 10);
    return queryInterface.bulkInsert('users', [
      {
        role: 1,
        name: 'Super Admin',
        email: process.env.ADMIN_EMAIL,
        password: hashPassword,
        status: '1',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('users', {}, {});
  },
};