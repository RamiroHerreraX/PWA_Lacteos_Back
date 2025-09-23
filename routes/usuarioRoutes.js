/*const express = require("express");
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

*/
const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const authController = require("../controllers/authController");

// Rutas de autenticación
router.post("/login", usuarioController.loginUsuario);
router.post("/verificar-otp", usuarioController.verificarOtp);

// Rutas de recuperación - ORDEN IMPORTANTE
router.post("/reset/usuario", authController.recuperarUsuario);
router.post("/reset/enviar", authController.enviarEnlaceReset);
router.post("/reset/verificar-otp", authController.verificarOtp);
// Esta ruta debe ir ÚLTIMA para evitar conflictos
router.post("/reset/:token", authController.restablecerPassword);

// Rutas de usuarios
router.get("/usuario", usuarioController.listarUsuarios);
//router.post("/usuario", usuarioController.crearUsuario);
router.post("/usuario/nuevo", usuarioController.crearUsuario);
module.exports = router;