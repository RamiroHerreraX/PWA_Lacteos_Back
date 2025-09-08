const Usuario = require("../models/Usuario");
const bcrypt = require("bcrypt");


exports.listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.obtenerTodos();
    res.json(usuarios); 
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

    res.status(201).json({ message: "Usuario creado", usuario: nuevoUsuario });
  } catch (err) {
    res.status(500).json({ error: "Error al crear usuario: " + err.message });
  }
};
