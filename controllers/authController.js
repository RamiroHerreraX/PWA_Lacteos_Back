const crypto = require("crypto");
const Usuario = require("../models/Usuario");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

const resetTokens = {};
const offlineResetsFile = path.join(__dirname, "../offline-resets.json");
const offlineFile = path.join(__dirname, "../offline-users.json");

const guardarOfflineResets = (resets) => {
  fs.writeFileSync(offlineResetsFile, JSON.stringify(resets, null, 2));
};

const leerOfflineResets = () => {
  if (!fs.existsSync(offlineResetsFile)) return [];
  return JSON.parse(fs.readFileSync(offlineResetsFile, "utf-8"));
};

// Recuperar usuario
exports.recuperarUsuario = async (req, res) => {
  const { email } = req.body;
  let user;

  try {
    user = await Usuario.obtenerPorEmail(email);
  } catch (err) {
    console.warn("DB no disponible, buscando en offline-users.json...");
    const usuariosOffline = fs.existsSync(offlineFile)
      ? JSON.parse(fs.readFileSync(offlineFile, "utf-8"))
      : [];
    user = usuariosOffline.find(u => u.email === email);
  }

  if (!user) return res.status(404).json({ msg: "Correo no registrado" });

  // Intentar enviar correo
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Recuperación de usuario",
      text: `Hola, tu nombre de usuario es: ${user.nombre}`
    });

    res.json({ msg: "Tu nombre de usuario fue enviado al correo" });
  } catch (err) {
    console.warn("No se pudo enviar correo, devolviendo respuesta offline:", err.message);
    res.json({ msg: "Modo offline: tu nombre de usuario es", usuario: user.nombre });
  }
};

// Enviar enlace para restablecer contraseña
exports.enviarEnlaceReset = async (req, res) => {
  const { email } = req.body;
  let user;

  // Buscar usuario
  try {
    user = await Usuario.obtenerPorEmail(email);
  } catch (err) {
    console.warn("DB no disponible, usando offline-users.json...");
    const usuariosOffline = fs.existsSync(offlineFile)
      ? JSON.parse(fs.readFileSync(offlineFile, "utf-8"))
      : [];
    user = usuariosOffline.find(u => u.email === email);
  }

  if (!user) return res.status(404).json({ msg: "Correo no registrado" });

  // Generar token y OTP (solo para admin)
  const token = crypto.randomBytes(32).toString("hex");
  const otp = user.rol === "admin" ? Math.floor(100000 + Math.random() * 900000) : undefined;
  const expires = Date.now() + (user.rol === "admin" ? 5*60*1000 : 15*60*1000);

  // Guardar en offline-resets.json
  const resets = leerOfflineResets();
  guardarOfflineResets([...resets, { email, token, otp, expires }]);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false }
    });

    if (user.rol === "admin") {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Recuperación administrador - OTP requerido",
        html: `<p>Tu OTP es: <b>${otp}</b>. Válido por 5 minutos.</p>`
      });
      return res.json({ msg: "OTP enviado al correo", token });
    } else {
      const resetUrl = `http://localhost:4200/reset/${token}`;
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Restablece tu contraseña",
        html: `<p>Haz clic en el enlace para restablecer tu contraseña:</p>
               <a href="${resetUrl}">${resetUrl}</a>`
      });
      return res.json({ msg: "Enlace enviado al correo", token, resetUrl });
    }
  } catch (err) {
    console.warn("Correo no enviado, modo offline:", err.message);
    // Respuesta offline
    if (user.rol === "admin") {
      return res.json({ msg: "Modo offline: OTP generado", token, otp });
    } else {
      const resetUrl = `http://localhost:4200/reset/${token}`;
      return res.json({ msg: "Modo offline: usa este token para resetear", token, resetUrl });
    }
  }
};


// Restablecer contraseña
exports.restablecerPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const resets = leerOfflineResets();
  const resetData = resets.find(r => r.token === token);

  if (!resetData) return res.status(400).json({ msg: "Token inválido" });
  if (Date.now() > resetData.expires) {
    guardarOfflineResets(resets.filter(r => r.token !== token));
    return res.status(400).json({ msg: "Token expirado" });
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  try {
    await Usuario.actualizarPassword(resetData.email, hashed);
  } catch (err) {
    console.warn("DB no disponible, actualizando en offline-users.json...");
    const usuariosOffline = fs.existsSync(offlineFile)
      ? JSON.parse(fs.readFileSync(offlineFile, "utf-8"))
      : [];
    const index = usuariosOffline.findIndex(u => u.email === resetData.email);
    if (index >= 0) {
      usuariosOffline[index].password = hashed;
      fs.writeFileSync(offlineFile, JSON.stringify(usuariosOffline, null, 2));
    }
  }

  // Eliminar token usado
  guardarOfflineResets(resets.filter(r => r.token !== token));

  res.json({ msg: "Contraseña actualizada correctamente" });
};

exports.verificarOtp = async (req, res) => {
  const { email, otp, token } = req.body;

  if (!email || !token) return res.status(400).json({ msg: "Faltan datos requeridos" });

  const resets = leerOfflineResets();
  const resetData = resets.find(r => r.token === token);

  if (!resetData) return res.status(400).json({ msg: "Token inválido" });
  if (resetData.email !== email) return res.status(400).json({ msg: "El correo no coincide con el token" });
  if (Date.now() > resetData.expires) {
    guardarOfflineResets(resets.filter(r => r.token !== token));
    return res.status(400).json({ msg: "OTP expirado" });
  }
  if (resetData.otp && parseInt(otp) !== resetData.otp) return res.status(400).json({ msg: "OTP incorrecto" });

  // OTP correcto: generar token de reset final
  const resetToken = crypto.randomBytes(32).toString("hex");
  const newResets = resets.filter(r => r.token !== token); // eliminar token OTP usado
  newResets.push({ email, token: resetToken, expires: Date.now() + 15*60*1000 }); // guardar token final
  guardarOfflineResets(newResets);

  const resetUrl = `http://localhost:4200/reset/${resetToken}`;

  // Intentar enviar correo con el enlace final (solo si estamos online)
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Enlace final para restablecer contraseña",
      html: `<p>Tu OTP fue verificado correctamente.</p>
             <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
             <a href="${resetUrl}">${resetUrl}</a>`
    });
  } catch (err) {
    console.warn("No se pudo enviar correo con enlace final:", err.message);
  }

  res.json({
    msg: "OTP verificado correctamente. Usa este enlace para restablecer la contraseña",
    resetToken,
    resetUrl
  });
};
