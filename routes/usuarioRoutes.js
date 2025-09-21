const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");

router.get("/usuario", usuarioController.listarUsuarios);
router.post("/usuario/nuevo", usuarioController.crearUsuario);
router.post("/login", usuarioController.loginUsuario);

module.exports = router;

