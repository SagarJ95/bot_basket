import { Sequelize } from 'sequelize';

const env = process.env.NODE_ENV || 'development';
//const config = require('./config')[env];
import config from './config.js';

const sequelize = new Sequelize(config.development);

export default sequelize;