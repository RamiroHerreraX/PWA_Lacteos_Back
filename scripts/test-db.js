// scripts/test-db.js
const pool = require('../config/db');

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión a PostgreSQL exitosa');
    
    const result = await client.query('SELECT version()');
    console.log('📊 Versión de PostgreSQL:', result.rows[0].version);
    
    const users = await client.query('SELECT * FROM usuarios');
    console.log('👥 Usuarios en la base de datos:', users.rows.length);
    
    client.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    process.exit(1);
  }
}

testConnection();