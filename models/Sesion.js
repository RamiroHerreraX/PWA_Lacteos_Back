const pool = require("../config/db");

class Sesion {
  // Guardar nueva sesión
  static async crear({ usuario_id, ip, ubicacion }) {
    const result = await pool.query(
      `INSERT INTO sesion (usuario_id, ip, ubicacion, fecha)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [usuario_id, ip, ubicacion ? JSON.stringify(ubicacion) : null]
    );
    return result.rows[0];
  }

  // Obtener historial por usuario
  static async obtenerPorUsuario(usuario_id) {
    const result = await pool.query(
      `SELECT * FROM sesion
       WHERE usuario_id = $1
       ORDER BY fecha DESC`,
      [usuario_id]
    );
    return result.rows;
  }
}

module.exports = Sesion;
