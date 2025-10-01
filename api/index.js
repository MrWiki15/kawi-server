import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRouter from "./routes/healtRouter.js";
import marketRouter from "./routes/marketRouter.js";
import pinataRouter from "./routes/pinataRouter.js";
import createRouter from "./routes/createRouter.js";
import launchpadRouter from "./routes/launchpadRouter.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Usar las rutas
app.use("/api/market", marketRouter); //mercado nft
app.use("/api/health", healthRouter); //debug
app.use("/api/pinata", pinataRouter); //metadata
app.use("/api/create", createRouter); //creacion de nfts
app.use("/api/launchapd", launchpadRouter); //mint en el launchpad

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

//Despliegue en server normal
app.listen(3001, () => {
  console.log(
    "_________________________Info del server_________________________"
  );
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
  console.log(
    `🔒 Modo seguro: ${
      process.env.NODE_ENV === "production" ? "Activado" : "Desarrollo"
    }`
  );
  console.log(
    "_________________________Rutas del server_________________________"
  );
  console.log("/api/health");
  console.log("/api/market/create (Crear una coleccion NFT)");
  console.log("/api/market/list (Listar un NFT)");
  console.log("/api/market/list/code (Crear codigo de seguridad unico)");
  console.log("/api/market/deslist (Deslistar un NFT)");
  console.log("/api/market/buy (Comprar un NFT)");
  console.log("/api/pinata/upload-image (Subir una imagen individual)");
  console.log("/api/pinata/upload-metadata (Subir metadata individual)");
  console.log("/api/pinata/upload-collection (Subir metadata de colección)");
  console.log(
    "/api/pinata/upload-batch-images (Subir múltiples imágenes en lote)"
  );
  console.log(
    "/api/pinata/upload-batch-metadata (Subir múltiples metadatas en lote)"
  );
  console.log("/api/pinata/status (Verificar conexión y estado de Pinata)");
});

// Exportar la app para Vercel
export default app;
