const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");

router.get("/usuario", usuarioController.listarUsuarios);
router.post("/usuario/nuevo", usuarioController.crearUsuario);
router.post("/login", usuarioController.loginUsuario);
router.post("/verificar-otp", usuarioController.verificarOtp);

module.exports = router;

