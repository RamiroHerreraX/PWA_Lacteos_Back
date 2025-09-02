const express = require("express");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const app = express();
const port = 3000;

// Cargar especificación desde swagger.yaml
const swaggerDocument = YAML.load("./swagger.yaml");

// Ruta de documentación
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}/docs`);
});
