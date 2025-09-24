const Usuario = require("../models/Usuario");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const { userActivity } = require("../middlewares/verificarActividad");

const offlineFile = path.join(__dirname, "../offline-users.json");
const otpStore = {};


// Guardar usuarios en offline-users.json
const guardarOffline = (usuarios) => {
  fs.writeFileSync(offlineFile, JSON.stringify(usuarios, null, 2));
};

// Leer usuarios del cache
const leerOffline = () => {
  if (!fs.existsSync(offlineFile)) return [];
  const data = fs.readFileSync(offlineFile, "utf-8");
  return JSON.parse(data);
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

exports.loginUsuario = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await Usuario.obtenerPorEmail(email);
    if (!user) return res.status(400).json({ msg: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Contraseña incorrecta" });

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
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
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
      console.warn("No se pudo enviar correo, usando login offline:", err.message);
      return exports.loginOffUsuario(req, res);
    }

  } catch (err) {
    console.error("Error en loginUsuario:", err);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Contraseña incorrecta" });

    // Generar OTP offline
    const otp = speakeasy.totp({
      secret: speakeasy.generateSecret().base32,
      encoding: "base32",
      step: 300,
      digits: 6,
    });
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    userActivity[user.email] = Date.now();


    const usuariosOffline = leerOffline();
    const index = usuariosOffline.findIndex(u => u.email === email);
    if (index >= 0) {
      usuariosOffline[index] = user;
    } else {
      usuariosOffline.push(user);
    }
    guardarOffline(usuariosOffline);

    res.json({ msg: "Login exitoso (offline) - código 2FA generado", otp });

  } catch (err) {
    console.error("Error en loginOffUsuario:", err);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// --- Verificar OTP ---
exports.verificarOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!otpStore[email]) return res.status(400).json({ msg: "OTP no generado" });

  if (Date.now() > otpStore[email].expires) {
    delete otpStore[email];
    return res.status(400).json({ msg: "OTP expirado" });
  }

  if (otp !== otpStore[email].otp.toString())
    return res.status(400).json({ msg: "OTP incorrecto" });

  let user;
  try {
    user = await Usuario.obtenerPorEmail(email);
  } catch {
    // Buscar en offline si no hay internet
    const usuariosOffline = leerOffline();
    user = usuariosOffline.find(u => u.email === email);
  }

  if (!user) return res.status(400).json({ msg: "Usuario no encontrado" });

  const token = jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

    userActivity[user.email] = Date.now();
  delete otpStore[email];
  res.json({ token, rol: user.rol });
};

