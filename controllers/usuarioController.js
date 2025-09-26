const Usuario = require("../models/Usuario");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const geoip = require("geoip-lite");
const pool = require("../config/db");
const Sesion = require("../models/Sesion");
const { userActivity } = require("../middlewares/verificarActividad");
const { obtenerUbicacionIP } = require("./geoip");

const offlineFile = path.join(__dirname, "../offline-users.json");
const otpStore = {};
const loginAttempts = {}; // { email: { intentos: 0, bloqueos: 0, bloqueoHasta: null } }

// ================= Funciones auxiliares =================
const guardarOffline = (usuarios) => fs.writeFileSync(offlineFile, JSON.stringify(usuarios, null, 2));
const leerOffline = () => fs.existsSync(offlineFile) ? JSON.parse(fs.readFileSync(offlineFile, "utf-8")) : [];
const verificarBloqueo = (email) => {
  const info = loginAttempts[email];
  if (!info) return false;
  if (info.bloqueoHasta && Date.now() < info.bloqueoHasta) return true;
  return false;
};

// ================= Validaciones =================
const validarEmail = (email) => {
  if (!email) return "Email requerido";
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) ? null : "Formato de email inválido";
};

const validarPassword = (password) => {
  if (!password) return "Contraseña requerida";
  if (password.length < 6) return "Contraseña debe tener al menos 6 caracteres";
  return null;
};

const validarNombre = (nombre) => {
  if (!nombre) return "Nombre requerido";
  if (nombre.length < 2) return "Nombre demasiado corto";
  return null;
};

const validarRol = (rol) => {
  const rolesPermitidos = ["admin", "usuario"];
  if (!rol) return "Rol requerido";
  if (!rolesPermitidos.includes(rol)) return `Rol inválido. Valores permitidos: ${rolesPermitidos.join(", ")}`;
  return null;
};

const validarOtp = (otp) => {
  if (!otp) return "OTP requerido";
  if (!/^\d{6}$/.test(otp)) return "OTP debe tener 6 dígitos";
  return null;
};

// ================= LOGIN CON BASE DE DATOS =================
exports.loginUsuario = async (req, res) => {
  const { email, password } = req.body;

  // Validaciones
  const emailError = validarEmail(email);
  if (emailError) return res.status(400).json({ msg: emailError });
  const passError = validarPassword(password);
  if (passError) return res.status(400).json({ msg: passError });

  try {
    const user = await Usuario.obtenerPorEmail(email);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    if (!loginAttempts[email]) loginAttempts[email] = { intentos: 0, bloqueos: 0, bloqueoHasta: null };
    if (verificarBloqueo(email)) {
      const tiempoRestante = Math.ceil((loginAttempts[email].bloqueoHasta - Date.now()) / 1000);
      return res.status(403).json({ msg: `Usuario bloqueado. Intenta en ${tiempoRestante} segundos.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      loginAttempts[email].intentos += 1;
      if (loginAttempts[email].intentos >= 5) {
        loginAttempts[email].intentos = 0;
        loginAttempts[email].bloqueos += 1;
        if (loginAttempts[email].bloqueos >= 3) {
          loginAttempts[email].bloqueoHasta = Date.now() + 24 * 60 * 60 * 1000; // 24h
          loginAttempts[email].bloqueos = 0;
          return res.status(403).json({ msg: "Usuario bloqueado 24 horas por múltiples intentos fallidos" });
        } else {
          loginAttempts[email].bloqueoHasta = Date.now() + 60 * 1000; // 1 minuto
          return res.status(403).json({ msg: "Usuario bloqueado 1 minuto por 5 intentos fallidos" });
        }
      }
      return res.status(400).json({ msg: "Contraseña incorrecta" });
    }

    loginAttempts[email].intentos = 0;
    loginAttempts[email].bloqueos = 0;

    // Generar OTP
    const otp = speakeasy.totp({ secret: speakeasy.generateSecret().base32, encoding: "base32", step: 300, digits: 6 });
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false }
    });

    try {
      await transporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject: "Código de verificación 2FA", text: `Tu código es: ${otp}` });
      return res.json({ msg: "Código 2FA enviado al correo" });
    } catch (err) {
      console.warn("Error enviando correo, intentando login offline:", err.message);
      return exports.loginOffUsuario(req, res);
    }

  } catch (err) {
    console.error("Error en loginUsuario:", err);
    return res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ================= LOGIN OFFLINE =================
exports.loginOffUsuario = async (req, res) => {
  const { email, password } = req.body;

  const emailError = validarEmail(email);
  if (emailError) return res.status(400).json({ msg: emailError });
  const passError = validarPassword(password);
  if (passError) return res.status(400).json({ msg: passError });

  try {
    let user;
    try { user = await Usuario.obtenerPorEmail(email); } 
    catch { 
      const usuariosOffline = leerOffline();
      user = usuariosOffline.find(u => u.email === email);
    }

    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    if (!loginAttempts[email]) loginAttempts[email] = { intentos: 0, bloqueos: 0, bloqueoHasta: null };
    if (verificarBloqueo(email)) {
      const tiempoRestante = Math.ceil((loginAttempts[email].bloqueoHasta - Date.now()) / 1000);
      return res.status(403).json({ msg: `Usuario bloqueado. Intenta en ${tiempoRestante} segundos.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      loginAttempts[email].intentos += 1;
      if (loginAttempts[email].intentos >= 5) {
        loginAttempts[email].intentos = 0;
        loginAttempts[email].bloqueos += 1;
        if (loginAttempts[email].bloqueos >= 3) {
          loginAttempts[email].bloqueoHasta = Date.now() + 24 * 60 * 60 * 1000; // 24h
          loginAttempts[email].bloqueos = 0;
          return res.status(403).json({ msg: "Usuario bloqueado 24 horas por múltiples intentos fallidos" });
        } else {
          loginAttempts[email].bloqueoHasta = Date.now() + 60 * 1000; // 1 minuto
          return res.status(403).json({ msg: "Usuario bloqueado 1 minuto por 5 intentos fallidos" });
        }
      }
      return res.status(400).json({ msg: "Contraseña incorrecta" });
    }

    loginAttempts[email].intentos = 0;
    loginAttempts[email].bloqueos = 0;

    const otp = speakeasy.totp({ secret: speakeasy.generateSecret().base32, encoding: "base32", step: 300, digits: 6 });
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    userActivity[user.email] = { lastActive: Date.now(), token: null };

    const usuariosOffline = leerOffline();
    const index = usuariosOffline.findIndex(u => u.email === email);
    if (index >= 0) usuariosOffline[index] = user;
    else usuariosOffline.push(user);
    guardarOffline(usuariosOffline);

    return res.json({ msg: "Login exitoso (offline) - código 2FA generado", otp });

  } catch (err) {
    console.error("Error en loginOffUsuario:", err);
    return res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ================= CREAR USUARIO =================
exports.crearUsuario = async (req, res) => {
  const { nombre, email, password, rol } = req.body;

  const nombreError = validarNombre(nombre);
  if (nombreError) return res.status(400).json({ msg: nombreError });
  const emailError = validarEmail(email);
  if (emailError) return res.status(400).json({ msg: emailError });
  const passError = validarPassword(password);
  if (passError) return res.status(400).json({ msg: passError });
  const rolError = validarRol(rol);
  if (rolError) return res.status(400).json({ msg: rolError });

  try {
    const existe = await Usuario.obtenerPorEmail(email);
    if (existe) return res.status(400).json({ msg: "El correo ya está registrado" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = await Usuario.crear({ nombre, email, password: hashedPassword, rol });

    const usuariosOffline = leerOffline();
    guardarOffline([...usuariosOffline, nuevoUsuario]);

    return res.status(201).json({ msg: "Usuario creado", usuario: nuevoUsuario });

  } catch (err) {
    console.error("Error creando usuario:", err);
    return res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ================= VERIFICAR OTP =================
exports.verificarOtp = async (req, res) => {
  const { email, otp } = req.body;

  const emailError = validarEmail(email);
  if (emailError) return res.status(400).json({ msg: emailError });
  const otpError = validarOtp(otp);
  if (otpError) return res.status(400).json({ msg: otpError });

  try {
    if (!otpStore[email]) return res.status(400).json({ msg: "OTP no generado" });
    if (Date.now() > otpStore[email].expires) { delete otpStore[email]; return res.status(400).json({ msg: "OTP expirado" }); }
    if (otp !== otpStore[email].otp.toString()) return res.status(400).json({ msg: "OTP incorrecto" });

    const user = await Usuario.obtenerPorEmail(email);
    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: "1h" });

    let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (ip && ip.includes(",")) ip = ip.split(",")[0].trim();

    let esLocalhost = false;
    if (ip === "::1" || ip === "127.0.0.1" || !ip) { esLocalhost = true; ip = "189.204.0.0"; }

    let ubicacion = ip ? await obtenerUbicacionIP(ip) : null;
    if (!ubicacion && esLocalhost) ubicacion = { ip, country: "MX", region: "CMX", city: "Ciudad de México", ll: [19.42847, -99.12766], timezone: "America/Mexico_City" };

    await pool.query(`INSERT INTO sesion (usuario_id, ip, ubicacion, fecha) VALUES ($1, $2, $3, NOW())`, [user.id, ip, JSON.stringify(ubicacion)]);

    userActivity[user.email] = { lastActive: Date.now(), token };
    delete otpStore[email];

    return res.json({ token, rol: user.rol, ubicacion: ubicacion || "No disponible" });

  } catch (err) {
    console.error("Error en verificarOtp:", err);
    return res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ================= HISTORIAL DE SESIONES =================
exports.historialSesiones = async (req, res) => {
  try {
    const userId = req.user.id;
    const sesiones = await Sesion.obtenerPorUsuario(userId);
    if (!sesiones || sesiones.length === 0) return res.status(404).json({ msg: "No hay historial de sesiones" });
    return res.json(sesiones);
  } catch (err) {
    console.error("Error historialSesiones:", err);
    return res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ================= LISTAR USUARIOS =================
exports.listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.obtenerTodos();
    if (!usuarios || usuarios.length === 0) return res.status(404).json({ msg: "No se encontraron usuarios" });
    return res.json(usuarios);
  } catch (err) {
    console.error("Error listarUsuarios:", err);
    return res.status(500).json({ msg: "Error en el servidor" });
  }
};
