import { Router } from "express";
import {
  uploadImage,
  uploadMetadata,
  uploadCollectionMetadata,
  uploadBatchImages,
  uploadBatchMetadata,
  getPinataStatus,
  getFileInfoController,
  createSignedURL,
} from "../controlers/pinataController/pinataController.js";
import multer from "multer";

const pinataRouter = Router();

// Configuración de multer
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 * 1024 }, // 50MB por archivo, ajustar
});

/**
 * RUTA: POST /api/pinata/upload-image
 * FUNCIÓN: Subir una imagen individual a IPFS (v3 API)
 */
pinataRouter.post("/upload-image", upload.single("image"), uploadImage);

/**

 * RUTA: POST /api/pinata/upload-metadata
 * FUNCIÓN: Subir metadata individual de NFT a IPFS (v3 API)
 */
pinataRouter.post("/upload-metadata", uploadMetadata);

/**
 * RUTA: POST /api/pinata/upload-collection
 * FUNCIÓN: Subir metadata de la colección completa a IPFS (v3 API)
 */
pinataRouter.post("/upload-collection", uploadCollectionMetadata);

/**
 * RUTA: POST /api/pinata/upload-batch-images
 * FUNCIÓN: Subir múltiples imágenes en lote a IPFS (v3 API)
 */
pinataRouter.post(
  "/upload-batch-images",
  upload.array("images", 50),
  uploadBatchImages
);

/**
 * RUTA: POST /api/pinata/upload-batch-metadata
 * FUNCIÓN: Subir múltiples metadatas en lote a IPFS (v3 API)
 */
pinataRouter.post("/upload-batch-metadata", uploadBatchMetadata);

/**
 * RUTA: GET /api/pinata/status
 * FUNCIÓN: Verificar conexión y estado de Pinata (v3 API)
 */
pinataRouter.get("/status", getPinataStatus);

/**
 * RUTA: GET /api/pinata/file-info/:cid
 * FUNCIÓN: Obtener información de un archivo por CID
 */
pinataRouter.get("/file-info/:cid", getFileInfoController);

/**
 * RUTA: POST /api/pinata/signed-url
 * FUNCIÓN: Crear URL firmada para subida desde cliente
 */
pinataRouter.post("/signed-url", createSignedURL);

export default pinataRouter;
