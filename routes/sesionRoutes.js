const express = require("express");
const router = express.Router();
const { getSesionesUsuario } = require("../controllers/sesionController");
const { verificarToken } = require("../middlewares/verificarActividad");

// GET /api/usuario/sesiones
router.get("/usuario/sesiones", verificarToken, getSesionesUsuario);

module.exports = router;
