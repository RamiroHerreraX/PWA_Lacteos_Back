const pool = require("../config/db");

class Usuario {
  static async obtenerTodos() {
    const result = await pool.query("SELECT * FROM usuarios ORDER BY id ASC");
    return result.rows;
  }

  static async crear({ nombre, email, password, rol }) {
    const result = await pool.query(
      "INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4) RETURNING *",
      [nombre, email, password, rol]
    );
    return result.rows[0];
  }

  static async obtenerPorEmail(email) {
    const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
    return result.rows[0]; 
  }
}

module.exports = Usuario;
