const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const usuarioRoutes = require("./routes/usuarioRoutes");
const sesionRoutes = require("./routes/sesionRoutes");
require("dotenv").config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// swagger.yaml
const swaggerDocument = YAML.load("./swagger.yaml");

// Rutas
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api",usuarioRoutes);
app.use("/api", sesionRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error("❌ Error capturado:", err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Error interno del servidor"
  });
});
