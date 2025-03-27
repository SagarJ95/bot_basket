import db from '../config/db.js';

const adminLog = async (data) => {
    await db.query('INSERT INTO user_activity (user_id, table_id, table_name, action) VALUES ($1, $2, $3, $4)', [data.user_id, data.table_id, data.table_name, data.action]);
}


export default adminLog;