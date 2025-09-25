const Usuario = require("../models/Usuario");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const geoip = require("geoip-lite");

const { userActivity } = require("../middlewares/verificarActividad");

const offlineFile = path.join(__dirname, "../offline-users.json");
const otpStore = {};
const loginAttempts = {}; 
/*
Estructura por email:
loginAttempts[email] = {
  intentos: 0,
  bloqueos: 0,
  bloqueoHasta: null
}
*/

// ================= Funciones auxiliares =================
const guardarOffline = (usuarios) => {
  fs.writeFileSync(offlineFile, JSON.stringify(usuarios, null, 2));
};

const leerOffline = () => {
  if (!fs.existsSync(offlineFile)) return [];
  const data = fs.readFileSync(offlineFile, "utf-8");
  return JSON.parse(data);
};

const verificarBloqueo = (email) => {
  const info = loginAttempts[email];
  if (!info) return false;
  if (info.bloqueoHasta && Date.now() < info.bloqueoHasta) return true;
  return false;
};


// ================= LOGIN CON BASE DE DATOS =================
exports.loginUsuario = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await Usuario.obtenerPorEmail(email);
    if (!user) return res.status(400).json({ msg: "Usuario no encontrado" });

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

    // ✅ Login exitoso: reiniciar intentos y bloqueos
    loginAttempts[email].intentos = 0;
    loginAttempts[email].bloqueos = 0; // 🔹 reiniciar bloqueos al iniciar sesión

    // Generar OTP
    const otp = speakeasy.totp({
      secret: speakeasy.generateSecret().base32,
      encoding: "base32",
      step: 300,
      digits: 6,
    });
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false }
    });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Código de verificación 2FA",
        text: `Tu código es: ${otp}`
      });
      res.json({ msg: "Código 2FA enviado al correo" });
    } catch (err) {
      console.warn("No se pudo enviar correo, intentando login offline:", err.message);
      return exports.loginOffUsuario(req, res);
    }

  } catch (err) {
    console.error("Error en loginUsuario:", err);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ================= LOGIN OFFLINE =================
exports.loginOffUsuario = async (req, res) => {
  const { email, password } = req.body;

  try {
    let user;
    try {
      user = await Usuario.obtenerPorEmail(email);
    } catch (err) {
      console.warn("Base de datos offline, buscando en cache...");
      const usuariosOffline = leerOffline();
      user = usuariosOffline.find(u => u.email === email);
    }

    if (!user) return res.status(400).json({ msg: "Usuario no encontrado" });

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

    // ✅ Login exitoso offline: reiniciar intentos y bloqueos
    loginAttempts[email].intentos = 0;
    loginAttempts[email].bloqueos = 0;

    // Generar OTP offline
    const otp = speakeasy.totp({
      secret: speakeasy.generateSecret().base32,
      encoding: "base32",
      step: 300,
      digits: 6,
    });
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    userActivity[user.email] = {
    lastActive: Date.now(),
    token: null // aquí aún no tienes JWT, pero mantienes la estructura
  };


    const usuariosOffline = leerOffline();
    const index = usuariosOffline.findIndex(u => u.email === email);
    if (index >= 0) usuariosOffline[index] = user;
    else usuariosOffline.push(user);
    guardarOffline(usuariosOffline);

    res.json({ msg: "Login exitoso (offline) - código 2FA generado", otp });

  } catch (err) {
    console.error("Error en loginOffUsuario:", err);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};












const pool = require("../config/db");

const { obtenerUbicacionIP } = require("./geoip"); // ruta a geoip.js
exports.verificarOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // 1️⃣ Validar OTP
    if (!otpStore[email]) return res.status(400).json({ msg: "OTP no generado" });
    if (Date.now() > otpStore[email].expires) {
      delete otpStore[email];
      return res.status(400).json({ msg: "OTP expirado" });
    }
    if (otp !== otpStore[email].otp.toString()) return res.status(400).json({ msg: "OTP incorrecto" });

    // 2️⃣ Obtener usuario
    const user = await Usuario.obtenerPorEmail(email);

    // 3️⃣ Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4️⃣ Obtener IP real del cliente
    let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (ip && ip.includes(",")) ip = ip.split(",")[0].trim();

    // Detectar localhost y usar IP de prueba de México
    let esLocalhost = false;
    if (ip === "::1" || ip === "127.0.0.1" || !ip) {
      esLocalhost = true;
      ip = "189.204.0.0"; // IP pública de prueba de México
    }

    // 5️⃣ Obtener ubicación usando IPinfo
    let ubicacion = ip ? await obtenerUbicacionIP(ip) : null;

    // 6️⃣ Si no se obtiene ubicación (localhost), poner coordenadas de CDMX
    if (!ubicacion && esLocalhost) {
      ubicacion = {
        ip: ip,
        country: "MX",
        region: "CMX",
        city: "Ciudad de México",
        ll: [19.42847, -99.12766],
        timezone: "America/Mexico_City"
      };
    }

    // 7️⃣ Guardar sesión en la tabla "sesion"
    await pool.query(
      `INSERT INTO sesion (usuario_id, ip, ubicacion, fecha) VALUES ($1, $2, $3, NOW())`,
      [user.id, ip, ubicacion ? JSON.stringify(ubicacion) : null]
    );
    
    userActivity[user.email] = {
    lastActive: Date.now(),
    token // guardamos el JWT
    };

    // 8️⃣ Limpiar OTP
    delete otpStore[email];

    // 9️⃣ Responder con token, rol y ubicación
    res.json({
      token,
      rol: user.rol,
      ubicacion: ubicacion || "No disponible"
    });

  } catch (err) {
    next(err);
  }
};

const Sesion = require("../models/Sesion");

// ✅ Historial de sesiones de un usuario autenticado
exports.historialSesiones = async (req, res) => {
  try {
    const userId = req.user.id; // viene del token JWT

    const sesiones = await Sesion.obtenerPorUsuario(userId);

    if (!sesiones || sesiones.length === 0) {
      return res.status(404).json({ msg: "No hay historial de sesiones" });
    }

    res.json(sesiones);
  } catch (err) {
    console.error("Error al obtener historial:", err);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

exports.listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.obtenerTodos();

    if (!usuarios || usuarios.length === 0) {
      return res.status(404).json({ error: "No se encontraron usuarios" });
    }

    res.status(200).json(usuarios);
  } catch (err) {
    res.status(500).json({ error: "Error al listar usuarios: " + err.message });
  }
};


exports.crearUsuario = async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10); 

    const nuevoUsuario = await Usuario.crear({
      nombre,
      email,
      password: hashedPassword, 
      rol,
    });

    const usuariosOffline = leerOffline();
    guardarOffline([...usuariosOffline, nuevoUsuario]);

    res.status(201).json({ message: "Usuario creado", usuario: nuevoUsuario });
  } catch (err) {
    res.status(500).json({ error: "Error al crear usuario: " + err.message });
  }
};