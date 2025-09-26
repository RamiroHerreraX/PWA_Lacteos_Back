const pool = require("../config/db");

// ================== Obtener historial de sesiones ==================
const getSesionesUsuario = async (req, res) => {
  try {
    // Validación: verificar que req.user y req.user.id existen
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "Usuario no autenticado" });
    }

    const usuarioId = req.user.id;

    // Validación: id debe ser un número
    if (isNaN(usuarioId)) {
      return res.status(400).json({ msg: "ID de usuario inválido" });
    }

    // Consulta SQL segura con parámetros
    const result = await pool.query(
      "SELECT id, usuario_id, ip, ubicacion, fecha FROM sesion WHERE usuario_id = $1 ORDER BY fecha DESC",
      [usuarioId]
    );

    // Validación: verificar si hay registros
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ msg: "No hay historial de sesiones" });
    }

    // Respuesta exitosa
    return res.status(200).json({
      usuarioId,
      totalSesiones: result.rows.length,
      sesiones: result.rows
    });

  } catch (error) {
    console.error("Error al obtener sesiones:", error);
    return res.status(500).json({ msg: "Error en el servidor" });
  }
};

module.exports = { getSesionesUsuario };
