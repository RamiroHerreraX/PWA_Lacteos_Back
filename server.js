const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const usuarioRoutes = require("./routes/usuarioRoutes");
require("dotenv").config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Cargar especificación desde swagger.yaml
const swaggerDocument = YAML.load("./swagger.yaml");

// Rutas
//app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(usuarioRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});