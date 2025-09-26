const crypto = require("crypto");
const Usuario = require("../models/Usuario");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

// Archivos offline
const resetTokens = {};
const offlineResetsFile = path.join(__dirname, "../offline-resets.json");
const offlineFile = path.join(__dirname, "../offline-users.json");

// Funciones auxiliares
const guardarOfflineResets = (resets) => {
  fs.writeFileSync(offlineResetsFile, JSON.stringify(resets, null, 2));
};

const leerOfflineResets = () => {
  if (!fs.existsSync(offlineResetsFile)) return [];
  return JSON.parse(fs.readFileSync(offlineResetsFile, "utf-8"));
};

// Validación de email
const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ---------------------------------------------------------------------
// 🔹 1. Recuperar usuario
// ---------------------------------------------------------------------
exports.recuperarUsuario = async (req, res) => {
  const { email } = req.body;

  // Validación de entrada
  if (!email)
    return res.status(400).json({ msg: "El campo 'email' es obligatorio" });
  if (!validarEmail(email))
    return res.status(400).json({ msg: "El formato del correo no es válido" });

  let user;
  try {
    user = await Usuario.obtenerPorEmail(email);
  } catch (err) {
    console.warn("DB no disponible, buscando en offline-users.json...");
    const usuariosOffline = fs.existsSync(offlineFile)
      ? JSON.parse(fs.readFileSync(offlineFile, "utf-8"))
      : [];
    user = usuariosOffline.find((u) => u.email === email);
  }

  if (!user)
    return res.status(404).json({ msg: "No existe ningún usuario con ese correo" });

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Recuperación de usuario",
      text: `Hola, tu nombre de usuario es: ${user.nombre}`,
    });

    res.json({ msg: "Tu nombre de usuario fue enviado a tu correo electrónico" });
  } catch (err) {
    console.warn("No se pudo enviar correo:", err.message);
    res.json({
      msg: "No se pudo enviar el correo. Modo offline activo.",
      usuario: user.nombre,
    });
  }
};

// ---------------------------------------------------------------------
// 🔹 2. Enviar enlace para restablecer contraseña
// ---------------------------------------------------------------------
exports.enviarEnlaceReset = async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ msg: "El campo 'email' es obligatorio" });
  if (!validarEmail(email))
    return res.status(400).json({ msg: "El formato del correo no es válido" });

  let user;
  try {
    user = await Usuario.obtenerPorEmail(email);
  } catch (err) {
    console.warn("DB no disponible, usando offline-users.json...");
    const usuariosOffline = fs.existsSync(offlineFile)
      ? JSON.parse(fs.readFileSync(offlineFile, "utf-8"))
      : [];
    user = usuariosOffline.find((u) => u.email === email);
  }

  if (!user)
    return res.status(404).json({ msg: "No se encontró ningún usuario con ese correo" });

  const token = crypto.randomBytes(32).toString("hex");
  const otp = user.rol === "admin" ? Math.floor(100000 + Math.random() * 900000) : undefined;
  const expires = Date.now() + (user.rol === "admin" ? 5 * 60 * 1000 : 15 * 60 * 1000);

  const resets = leerOfflineResets();
  guardarOfflineResets([...resets, { email, token, otp, expires }]);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false },
    });

    if (user.rol === "admin") {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Recuperación administrador - OTP requerido",
        html: `<p>Tu OTP es: <b>${otp}</b>. Válido por 5 minutos.</p>`,
      });
      return res.json({ msg: "OTP enviado al correo", token });
    } else {
      const resetUrl = `http://localhost:4200/reset/${token}`;
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Restablece tu contraseña",
        html: `<p>Haz clic en el enlace para restablecer tu contraseña:</p>
               <a href="${resetUrl}">${resetUrl}</a>`,
      });
      return res.json({ msg: "Enlace de recuperación enviado", resetUrl });
    }
  } catch (err) {
    console.warn("No se pudo enviar correo:", err.message);
    return res.json({
      msg: "No se pudo enviar correo. Modo offline activo.",
      ...(user.rol === "admin"
        ? { otp, token }
        : { token, resetUrl: `http://localhost:4200/reset/${token}` }),
    });
  }
};

// ---------------------------------------------------------------------
// 🔹 3. Restablecer contraseña
// ---------------------------------------------------------------------
exports.restablecerPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!token) return res.status(400).json({ msg: "El token es obligatorio" });
  if (!newPassword)
    return res.status(400).json({ msg: "La nueva contraseña es obligatoria" });
  if (newPassword.length < 6)
    return res.status(400).json({ msg: "La contraseña debe tener al menos 6 caracteres" });

  const resets = leerOfflineResets();
  const resetData = resets.find((r) => r.token === token);

  if (!resetData) return res.status(400).json({ msg: "Token inválido" });
  if (Date.now() > resetData.expires) {
    guardarOfflineResets(resets.filter((r) => r.token !== token));
    return res.status(400).json({ msg: "Token expirado, solicita uno nuevo" });
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  try {
    await Usuario.actualizarPassword(resetData.email, hashed);
  } catch (err) {
    console.warn("DB no disponible, actualizando offline...");
    const usuariosOffline = fs.existsSync(offlineFile)
      ? JSON.parse(fs.readFileSync(offlineFile, "utf-8"))
      : [];
    const index = usuariosOffline.findIndex((u) => u.email === resetData.email);
    if (index >= 0) {
      usuariosOffline[index].password = hashed;
      fs.writeFileSync(offlineFile, JSON.stringify(usuariosOffline, null, 2));
    }
  }

  guardarOfflineResets(resets.filter((r) => r.token !== token));
  res.json({ msg: "Contraseña actualizada correctamente" });
};

// ---------------------------------------------------------------------
// 🔹 4. Verificar OTP (solo admin)
// ---------------------------------------------------------------------
exports.verificarOtp = async (req, res) => {
  const { email, otp, token } = req.body;

  if (!email || !token || !otp)
    return res.status(400).json({ msg: "Debes proporcionar email, token y OTP" });
  if (!validarEmail(email))
    return res.status(400).json({ msg: "El formato del correo no es válido" });

  const resets = leerOfflineResets();
  const resetData = resets.find((r) => r.token === token);

  if (!resetData) return res.status(400).json({ msg: "Token inválido" });
  if (resetData.email !== email)
    return res.status(400).json({ msg: "El correo no coincide con el token" });
  if (Date.now() > resetData.expires) {
    guardarOfflineResets(resets.filter((r) => r.token !== token));
    return res.status(400).json({ msg: "OTP expirado, solicita uno nuevo" });
  }
  if (parseInt(otp) !== resetData.otp)
    return res.status(400).json({ msg: "OTP incorrecto" });

  const resetToken = crypto.randomBytes(32).toString("hex");
  const newResets = resets.filter((r) => r.token !== token);
  newResets.push({ email, token: resetToken, expires: Date.now() + 15 * 60 * 1000 });
  guardarOfflineResets(newResets);

  const resetUrl = `http://localhost:4200/reset/${resetToken}`;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Enlace final para restablecer contraseña",
      html: `<p>OTP verificado correctamente.</p>
             <p>Haz clic en este enlace para restablecer tu contraseña:</p>
             <a href="${resetUrl}">${resetUrl}</a>`,
    });
  } catch (err) {
    console.warn("No se pudo enviar correo final:", err.message);
  }

  res.json({
    msg: "OTP verificado correctamente. Usa el enlace para restablecer la contraseña.",
    resetUrl,
  });
};
