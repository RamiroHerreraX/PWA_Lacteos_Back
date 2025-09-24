// scripts/seed-database.js
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function seedDatabase() {
    try {
        const client = await pool.connect();
        console.log('✅ Conectado a la base de datos');
        
        // Limpiar tabla
        await client.query('DELETE FROM usuarios');
        console.log('🗑️  Tabla usuarios limpiada');
        
        // Hashear passwords
        const adminHash = await bcrypt.hash('Admin123!', 10);
        const editorHash = await bcrypt.hash('Editor123!', 10);
        const lectorHash = await bcrypt.hash('Lector123!', 10);
        
        // Insertar usuarios de prueba
        await client.query(`
            INSERT INTO usuarios (nombre, email, password, rol) VALUES 
            ('Administrador Principal', 'admin@mail.com', $1, 'admin'),
            ('Editor General', 'editor@mail.com', $2, 'editor'),
            ('Lector Básico', 'lector@mail.com', $3, 'lector')
        `, [adminHash, editorHash, lectorHash]);
        
        console.log('✅ Usuarios de prueba insertados:');
        console.log('👑 Admin: admin@mail.com / Admin123!');
        console.log('✏️  Editor: editor@mail.com / Editor123!');
        console.log('👀 Lector: lector@mail.com / Lector123!');
        
        // Verificar inserción
        const result = await client.query('SELECT * FROM usuarios ORDER BY id');
        console.log(`📊 Total de usuarios en BD: ${result.rows.length}`);
        
        client.release();
        console.log('✅ Base de datos lista para pruebas');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

seedDatabase();