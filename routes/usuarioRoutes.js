/*const { verificarToken} = require("../middlewares/verificarActividad");
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
*/

const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const authController = require("../controllers/authController");
const { verificarToken, verificarActividad } = require("../middlewares/verificarActividad");

// ==================== AUTENTICACIÓN 2FA ====================
router.post("/login", usuarioController.loginUsuario);
router.post("/verificar-otp", usuarioController.verificarOtp);

// ==================== RECUPERACIÓN DE ACCESO ====================
router.post("/reset/usuario", authController.recuperarUsuario);
router.post("/reset/enviar", authController.enviarEnlaceReset);
router.post("/reset/verificar-otp", authController.verificarOtp);
router.post("/reset/:token", authController.restablecerPassword);

// ==================== GESTIÓN DE USUARIOS ====================
router.get("/usuario", verificarActividad, usuarioController.listarUsuarios);
router.post("/usuario/nuevo", verificarActividad, usuarioController.crearUsuario);

// ==================== SESIONES Y GEOLOCALIZACIÓN ====================
router.get("/sesiones", verificarToken, usuarioController.historialSesiones);

module.exports = router;