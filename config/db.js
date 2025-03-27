import pkg from 'pg';
const { Pool: pool } = pkg
import dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

const dbConfig = {
    user: process.env.DB_USERNAME,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
};

const db = new pool(dbConfig);

export default db;
