const pool = require("../config/db");

// Obtener historial de sesiones del usuario autenticado
const getSesionesUsuario = async (req, res) => {
  try {
    const usuarioId = req.user.id; // viene del middleware JWT

    const result = await pool.query(
      "SELECT id, usuario_id, ip, ubicacion, fecha FROM sesion WHERE usuario_id = $1 ORDER BY fecha DESC",
      [usuarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "❌ No hay historial de sesiones" });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener sesiones:", error);
    res.status(500).json({ message: "⚠️ Error en el servidor" });
  }
};

module.exports = { getSesionesUsuario };
