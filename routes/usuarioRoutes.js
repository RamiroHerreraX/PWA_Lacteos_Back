const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");

router.get("/api/usuarios", usuarioController.listarUsuarios);
router.post("/api/usuarios/nuevo", usuarioController.crearUsuario);

module.exports = router;

