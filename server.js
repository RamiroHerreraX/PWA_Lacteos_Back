/*const express = require("express");
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
*/

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

// Servir archivos estáticos para Swagger
app.use(express.static(path.join(__dirname, 'public')));

// Cargar Swagger desde el archivo YAML
const swaggerDocument = YAML.load('./swagger.yaml');

// Configuración personalizada de Swagger UI
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "🎯 PWA Lacteos - API Docs",
  swaggerOptions: {
    persistAuthorization: true,
    tryItOutEnabled: true
  }
};

// Rutas de documentación
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
app.use("/api", usuarioRoutes);
app.use("/api", sesionRoutes);

// Ruta de verificación de salud
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "🎯 PWA Lacteos API funcionando",
    timestamp: new Date().toISOString()
  });
});

// Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.path}`
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error("❌ Error capturado:", err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Error interno del servidor"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📚 Documentación Swagger en http://localhost:${PORT}/docs`);
});