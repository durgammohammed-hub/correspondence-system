const mysql = require("mysql2/promise");

const pool = mysql.createPool(process.env.MYSQL_URL + "?ssl={\"rejectUnauthorized\":false}");
module.exports = pool;
