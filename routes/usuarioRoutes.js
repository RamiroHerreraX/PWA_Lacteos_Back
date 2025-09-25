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

//BUENO
/*
const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const authController = require("../controllers/authController");

const { verificarActividad } = require("../middlewares/verificarActividad"); 
// Rutas de autenticación
router.post("/login", usuarioController.loginUsuario);
router.post("/verificar-otp", usuarioController.verificarOtp);

// Rutas de recuperación - ORDEN IMPORTANTE
router.post("/reset/usuario", authController.recuperarUsuario);
router.post("/reset/enviar", authController.enviarEnlaceReset);
router.post("/reset/verificar-otp", authController.verificarOtp);
router.post("/reset/:token", authController.restablecerPassword);

// Rutas de usuarios
router.get("/usuario", usuarioController.listarUsuarios);
router.post("/usuario/nuevo", usuarioController.crearUsuario);

module.exports = router;*/

const { verificarToken} = require("../middlewares/verificarActividad");
const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const authController = require("../controllers/authController");
const { verificarActividad } = require("../middlewares/verificarActividad");


// ==================== AUTENTICACIÓN ====================
router.post("/login", usuarioController.loginUsuario);
router.post("/verificar-otp", usuarioController.verificarOtp);

// ==================== RECUPERACIÓN ====================
router.post("/reset/usuario", authController.recuperarUsuario);
router.post("/reset/enviar", authController.enviarEnlaceReset);
router.post("/reset/verificar-otp", authController.verificarOtp);
router.post("/reset/:token", authController.restablecerPassword);

// ==================== GESTIÓN DE USUARIOS ====================
// router.get("/usuario", verificarActividad, usuarioController.listarUsuarios);
// router.post("/usuario/nuevo", verificarActividad, usuarioController.crearUsuario);
router.get("/usuario", verificarActividad,usuarioController.listarUsuarios);
router.post("/usuario/nuevo", verificarActividad,usuarioController.crearUsuario);
router.get("/sesiones", verificarToken, usuarioController.historialSesiones);

module.exports = router;