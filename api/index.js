import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import serverless from "serverless-http";
import healthRouter from "./routes/healtRouter.js";
import marketRouter from "./routes/marketRouter.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Usar las rutas
app.use("/api/market", marketRouter);
app.use("/api/health", healthRouter);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Exportar la app para Vercel
export default serverless(app);
