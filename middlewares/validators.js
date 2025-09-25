const { body, validationResult } = require('express-validator');
const Usuario = require("../models/Usuario");

// Validaciones para crear usuario
exports.validarCrearUsuario = [
  // Validación del campo 'nombre'
  body('nombre')
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios')
    .trim()
    .escape(),

  // Validación del campo 'email'
  body('email')
    .notEmpty()
    .withMessage('El email es obligatorio')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail()
    .custom(async (email) => {
      // Verificar si el email ya existe
      try {
        const usuarioExistente = await Usuario.obtenerPorEmail(email);
        if (usuarioExistente) {
          throw new Error('El email ya está registrado');
        }
      } catch (error) {
        // Si hay error al buscar, asumimos que no existe (para evitar bloquear creación)
        console.warn('Error verificando email:', error.message);
      }
      return true;
    }),

  // Validación del campo 'password'
  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),

  // Validación del campo 'rol'
  body('rol')
    .notEmpty()
    .withMessage('El rol es obligatorio')
    .isIn(['admin', 'editor', 'lector'])
    .withMessage('El rol debe ser: admin, editor o lector'),

  // Middleware para manejar los resultados de la validación
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array().map(error => ({
          campo: error.param,
          mensaje: error.msg,
          valor: error.value
        })),
        timestamp: new Date().toISOString()
      });
    }
    next();
  }
];

// Validación para verificar si el usuario que crea tiene permisos de admin
exports.verificarPermisosAdmin = (req, res, next) => {
  // Asumiendo que tienes información del usuario en req.user desde el middleware de autenticación
  if (req.user && req.user.rol === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Permisos insuficientes. Solo los administradores pueden crear usuarios',
      timestamp: new Date().toISOString()
    });
  }
};