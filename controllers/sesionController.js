const pool = require("../config/db");

// ================== Obtener historial de sesiones ==================


exports.obtenerPorUsuario = async (usuarioId) => {
  // Validar ID
  if (!usuarioId || isNaN(usuarioId)) throw new Error("ID de usuario inválido");

  // 🔹 1. Desactivar sesiones expiradas (más de 5 minutos)
  await pool.query(
    `UPDATE sesion 
     SET estado = 'desactivada' 
     WHERE usuario_id = $1 
       AND estado = 'activa' 
       AND fecha_expiracion <= NOW()`,
    [usuarioId]
  );

  // 🔹 2. Asegurar que solo haya una sesión activa por usuario
  const sesionesActivas = await pool.query(
    `SELECT id FROM sesion 
     WHERE usuario_id = $1 AND estado = 'activa' 
     ORDER BY fecha_creacion DESC`,
    [usuarioId]
  );

  if (sesionesActivas.rows.length > 1) {
    const ultimaSesion = sesionesActivas.rows[0].id;
    await pool.query(
      `UPDATE sesion 
       SET estado = 'desactivada' 
       WHERE usuario_id = $1 AND id <> $2`,
      [usuarioId, ultimaSesion]
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
    [usuarioId]
  );

  return result.rows;
};


const getSesionesUsuario = async (req, res) => {
  try {
    // Validación: verificar que req.user existe
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "Usuario no autenticado" });
    }

    const usuarioId = req.user.id;

    if (isNaN(usuarioId)) {
      return res.status(400).json({ msg: "ID de usuario inválido" });
    }

    // 🔹 1. Desactivar sesiones expiradas (más de 5 minutos)
    await pool.query(
      `UPDATE sesion 
       SET estado = 'desactivada' 
       WHERE estado = 'activa' 
       AND fecha_expiracion <= NOW()`
    );

    // 🔹 2. Solo se permite una sesión activa por usuario
    const sesionesActivas = await pool.query(
      `SELECT id, token, fecha_creacion, fecha_expiracion, estado 
       FROM sesion 
       WHERE usuario_id = $1 AND estado = 'activa'`,
      [usuarioId]
    );

    if (sesionesActivas.rows.length > 1) {
      // Desactivar todas menos la más reciente
      const ultimaSesion = sesionesActivas.rows[0].id;
      await pool.query(
        `UPDATE sesion 
         SET estado = 'desactivada' 
         WHERE usuario_id = $1 AND id <> $2`,
        [usuarioId, ultimaSesion]
      );
    }

    // 🔹 3. Obtener historial completo del usuario
    const result = await pool.query(
      `SELECT id, usuario_id, nombre, email, ip, ubicacion, 
              fecha_creacion, ultima_actividad, fecha_expiracion, 
              duracion, estado, token
       FROM sesion 
       WHERE usuario_id = $1 
       ORDER BY fecha_creacion DESC`,
      [usuarioId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ msg: "No hay historial de sesiones" });
    }

    return res.status(200).json({
      usuarioId,
      totalSesiones: result.rows.length,
      sesiones: result.rows,
    });

  } catch (error) {
    console.error("Error al obtener sesiones:", error);
    return res.status(500).json({ msg: "Error en el servidor" });
  }
};

module.exports = { getSesionesUsuario };
