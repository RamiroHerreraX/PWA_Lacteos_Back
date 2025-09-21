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
