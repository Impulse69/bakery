const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:0000@localhost:5432/bread_faculty' });
pool.query('SELECT * FROM sales_orders WHERE "orderNumber"=$1', ['TEMP']).then(res => { console.log(res.rows); process.exit(0); }).catch(console.error);
