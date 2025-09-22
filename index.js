const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Importar rutas
const transferNFTRoute = require("./api/transfer-nft");
const healthRoute = require("./api/health");

// Usar las rutas
app.post("/api/transfer-nft", transferNFTRoute);
app.get("/api/health", healthRoute);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Iniciar servidor solo si no estamos en Vercel
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Exportar la app para Vercel (si decides desplegar la app Express completa en Vercel, pero no es el enfoque de edge functions)
module.exports = app;
