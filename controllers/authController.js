const crypto = require("crypto");
const Usuario = require("../models/Usuario");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const resetTokens = {};

// Recuperar usuario
exports.recuperarUsuario = async (req, res) => {
  const { email } = req.body;
  const user = await Usuario.obtenerPorEmail(email);
  if (!user) return res.status(404).json({ msg: "Correo no registrado" });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Recuperación de usuario",
    text: `Hola, tu nombre de usuario es: ${user.nombre}`,
  });

  res.json({ msg: "Tu nombre de usuario fue enviado al correo" });
};

// Enviar enlace para restablecer contraseña
exports.enviarEnlaceReset = async (req, res) => {
  const { email } = req.body;
  const user = await Usuario.obtenerPorEmail(email);
  if (!user) return res.status(404).json({ msg: "Correo no registrado" });

  // Verificar rol
  if (user.rol === "admin") {
    // Flujo reforzado para administradores con OTP
    const token = crypto.randomBytes(32).toString("hex");
    const otp = Math.floor(100000 + Math.random() * 900000); // 6 dígitos
    resetTokens[token] = { email, otp, expires: Date.now() + 5 * 60 * 1000 };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Recuperación de administrador - OTP requerido",
      html: `<p>Tu OTP es: <b>${otp}</b>. Válido por 5 minutos.</p>`,
    });

    return res.json({ msg: "Se envió un OTP adicional para administradores", token });
  }

  // Flujo estándar para clientes/visitantes
  const token = crypto.randomBytes(32).toString("hex");
  resetTokens[token] = { email, expires: Date.now() + 15 * 60 * 1000 };

  const resetUrl = `http://localhost:4200/reset/${token}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Restablece tu contraseña",
    html: `<p>Haz clic en el enlace para restablecer tu contraseña:</p>
           <a href="${resetUrl}">${resetUrl}</a>`,
  });

  res.json({ msg: "Se envió un enlace para restablecer tu contraseña" });
};


// Restablecer contraseña
exports.restablecerPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const data = resetTokens[token];
  if (!data) return res.status(400).json({ msg: "Token inválido" });
  if (Date.now() > data.expires) {
    delete resetTokens[token];
    return res.status(400).json({ msg: "Token expirado" });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await Usuario.actualizarPassword(data.email, hashed);

  delete resetTokens[token];
  res.json({ msg: "Contraseña actualizada correctamente" });
};

exports.verificarOtp = async (req, res) => {
  const { email, otp, token } = req.body;

  if (!email || !otp || !token) {
    return res.status(400).json({ msg: "Faltan datos requeridos" });
  }

  const data = resetTokens[token];

  if (!data) return res.status(400).json({ msg: "Token inválido" });
  if (data.email !== email) return res.status(400).json({ msg: "El correo no coincide con el token" });
  if (Date.now() > data.expires) {
    delete resetTokens[token];
    return res.status(400).json({ msg: "OTP expirado" });
  }
  if (parseInt(otp) !== data.otp) return res.status(400).json({ msg: "OTP incorrecto" });

  // OTP correcto: generar nuevo token para restablecimiento
  const resetToken = crypto.randomBytes(32).toString("hex");
  resetTokens[resetToken] = { email, expires: Date.now() + 15 * 60 * 1000 }; // 15 min

  const resetUrl = `http://localhost:4200/reset/${resetToken}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Restablece tu contraseña",
    html: `<p>Haz clic en el enlace para restablecer tu contraseña:</p>
           <a href="${resetUrl}">${resetUrl}</a>`,
  });

  // Eliminamos el token OTP usado
  delete resetTokens[token];

  res.json({
    msg: "OTP verificado correctamente. Se envió un enlace para restablecer la contraseña",
    resetToken, // este token es opcional si quieres manejarlo desde el frontend
  });
};
