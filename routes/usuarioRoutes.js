const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const authController = require("../controllers/authController");

router.get("/usuario", usuarioController.listarUsuarios);
router.post("/usuario/nuevo", usuarioController.crearUsuario);

router.post("/login", usuarioController.loginUsuario);
router.post("/verificar-otp", usuarioController.verificarOtp);

router.post("/reset/verificar-otp", authController.verificarOtp);
router.post("/reset/usuario", authController.recuperarUsuario);
router.post("/reset/enviar", authController.enviarEnlaceReset);
router.post("/reset/:token", authController.restablecerPassword);

module.exports = router;

