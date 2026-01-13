const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ DB Connected");
  } catch (e) {
    console.error("❌ DB connect error:", e?.code, e?.message);
    console.error(e);
  }
})();

module.exports = pool;
