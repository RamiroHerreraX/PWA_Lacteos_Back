const jwt = require("jsonwebtoken");

const userActivity = {}; 
const INACTIVITY_LIMIT = 60 * 1000; 

const verificarActividad = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    const email = req.body?.email || req.query?.email;
    if (email && userActivity[email]?.token) {
      req.user = jwt.verify(userActivity[email].token, process.env.JWT_SECRET);
      return next();
    }
    return res.status(401).json({ msg: "Token no proporcionado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const lastActive = userActivity[decoded.email] || 0;

    if (Date.now() - lastActive > INACTIVITY_LIMIT) {
      delete userActivity[decoded.email];
      return res.status(401).json({ msg: "Sesión expirada por inactividad" });
    }

    // Actualizar última actividad
    userActivity[decoded.email] = Date.now();

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token inválido" });
  }
};

module.exports = { verificarActividad, userActivity };
