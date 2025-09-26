const pool = require("../config/db");

class Sesion {
  // ================== Crear nueva sesión ==================
  static async crear({ usuario_id, nombre, email, ip, ubicacion, token }) {
    // 🔹 Desactivar cualquier sesión activa previa del usuario
    await pool.query(
      `UPDATE sesion 
       SET estado = 'desactivada' 
       WHERE usuario_id = $1 AND estado = 'activa'`,
      [usuario_id]
    );

    // 🔹 Insertar nueva sesión activa (5 minutos por defecto)
    const result = await pool.query(
      `INSERT INTO sesion
       (usuario_id, nombre, email, ip, ubicacion, token, estado, fecha_creacion, ultima_actividad, fecha_expiracion)
       VALUES ($1, $2, $3, $4, $5, $6, 'activa', NOW(), NOW(), NOW() + INTERVAL '5 minutes')
       RETURNING *`,
      [
        usuario_id,
        nombre,
        email,
        ip,
        ubicacion ? JSON.stringify(ubicacion) : null,
        token
      ]
    );

    return result.rows[0];
  }

  // ================== Obtener historial por usuario ==================
  static async obtenerPorUsuario(usuario_id) {
    if (!usuario_id || isNaN(usuario_id)) throw new Error("ID de usuario inválido");

    // 🔹 1. Desactivar sesiones expiradas
    await pool.query(
      `UPDATE sesion
       SET estado = 'desactivada'
       WHERE usuario_id = $1
         AND estado = 'activa'
         AND fecha_expiracion <= NOW()`,
      [usuario_id]
    );

    // 🔹 2. Asegurar que solo haya una sesión activa
    const sesionesActivas = await pool.query(
      `SELECT id FROM sesion
       WHERE usuario_id = $1 AND estado = 'activa'
       ORDER BY fecha_creacion DESC`,
      [usuario_id]
    );

    if (sesionesActivas.rows.length > 1) {
      const ultimaSesion = sesionesActivas.rows[0].id;
      await pool.query(
        `UPDATE sesion
         SET estado = 'desactivada'
         WHERE usuario_id = $1 AND id <> $2`,
        [usuario_id, ultimaSesion]
      );
    }

    // 🔹 3. Obtener historial completo
    const result = await pool.query(
      `SELECT id, usuario_id, nombre, email, ip, ubicacion,
              fecha_creacion, ultima_actividad, fecha_expiracion,
              COALESCE(duracion, '0:05:00'::interval) AS duracion,
              estado, token
       FROM sesion
       WHERE usuario_id = $1
       ORDER BY fecha_creacion DESC`,
      [usuario_id]
    );

    return result.rows;
  }
}

module.exports = Sesion;
