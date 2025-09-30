import {
  uploadFileToPinata,
  uploadJSONToPinata,
  testPinataAuthentication,
  getFileInfo,
  createSignedUploadURL,
} from "../../utils/pinata.js";

/**
 * Controlador para subir imagen individual
 * RUTA: POST /api/pinata/upload-image
 */
export const uploadImage = async (req, res) => {
  try {
    console.log("📤 Subiendo imagen individual...");

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No se ha subido ningún archivo",
      });
    }

    const cid = await uploadFileToPinata(
      req.file.buffer,
      req.file.originalname,
      {
        name: req.file.originalname,
        keyvalues: {
          type: "nft-image",
          timestamp: new Date().toISOString(),
          uploadType: "single",
        },
      }
    );

    console.log("✅ Imagen subida exitosamente:", cid);
    res.json({
      success: true,
      cid: cid,
      ipfsUrl: `ipfs://${cid}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
      filename: req.file.originalname,
    });
  } catch (error) {
    console.error("❌ Error en uploadImage:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Controlador para subir metadata individual
 * RUTA: POST /api/pinata/upload-metadata
 */
export const uploadMetadata = async (req, res) => {
  try {
    console.log("📄 Subiendo metadata individual...");

    const metadata = req.body;
    if (!metadata || Object.keys(metadata).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No se ha proporcionado metadata",
      });
    }

    const cid = await uploadJSONToPinata(
      metadata,
      `nft-metadata-${Date.now()}`,
      {
        keyvalues: {
          type: "nft-metadata",
          timestamp: new Date().toISOString(),
          uploadType: "single",
        },
      }
    );

    console.log("✅ Metadata subida exitosamente:", cid);
    res.json({
      success: true,
      cid: cid,
      ipfsUrl: `ipfs://${cid}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
    });
  } catch (error) {
    console.error("❌ Error en uploadMetadata:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Controlador para subir metadata de colección
 * RUTA: POST /api/pinata/upload-collection
 */
export const uploadCollectionMetadata = async (req, res) => {
  try {
    console.log("🏷️ Subiendo metadata de colección...");

    const collectionData = req.body;
    if (!collectionData || Object.keys(collectionData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No se ha proporcionado la metadata de la colección",
      });
    }

    const cid = await uploadJSONToPinata(
      collectionData,
      `collection-metadata-${Date.now()}`,
      {
        keyvalues: {
          type: "collection-metadata",
          timestamp: new Date().toISOString(),
          totalNFTs: collectionData.nfts?.length || 0,
        },
      }
    );

    console.log("✅ Metadata de colección subida exitosamente:", cid);
    res.json({
      success: true,
      cid: cid,
      ipfsUrl: `ipfs://${cid}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
    });
  } catch (error) {
    console.error("❌ Error en uploadCollectionMetadata:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Controlador para subir lote de imágenes
 * RUTA: POST /api/pinata/upload-batch-images
 */
export const uploadBatchImages = async (req, res) => {
  try {
    console.log("🖼️ Subiendo lote de imágenes...");

    console.log(req.files);
    console.log("--------------------------------------");
    console.log(req.body);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No se han subido archivos",
      });
    }

    const results = [];

    for (const file of req.files) {
      try {
        const cid = await uploadFileToPinata(file.buffer, file.originalname, {
          name: file.originalname,
          keyvalues: {
            type: "nft-image",
            batchUpload: true,
            timestamp: new Date().toISOString(),
          },
        });

        results.push({
          filename: file.originalname,
          success: true,
          cid: cid,
          ipfsUrl: `ipfs://${cid}`,
          gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
        });
      } catch (fileError) {
        results.push({
          filename: file.originalname,
          success: false,
          error: fileError.message,
        });
      }
    }

    const successfulUploads = results.filter((r) => r.success).length;
    console.log(
      `✅ Lote de ${successfulUploads}/${results.length} imágenes procesado`
    );

    res.json({
      success: true,
      totalFiles: results.length,
      successfulUploads: successfulUploads,
      failedUploads: results.length - successfulUploads,
      results,
    });
  } catch (error) {
    console.error("❌ Error en uploadBatchImages:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Controlador para subir lote de metadatas
 * RUTA: POST /api/pinata/upload-batch-metadata
 */
export const uploadBatchMetadata = async (req, res) => {
  try {
    console.log("📋 Subiendo lote de metadatas...");

    const metadatas = req.body;
    if (!Array.isArray(metadatas)) {
      return res.status(400).json({
        success: false,
        error: "Se esperaba un array de metadatas",
      });
    }

    const results = [];

    for (let i = 0; i < metadatas.length; i++) {
      try {
        const cid = await uploadJSONToPinata(
          metadatas[i],
          `nft-${i + 1}-metadata-${Date.now()}`,
          {
            keyvalues: {
              type: "nft-metadata",
              batchUpload: true,
              timestamp: new Date().toISOString(),
              nftIndex: i + 1,
            },
          }
        );

        results.push({
          index: i,
          success: true,
          cid: cid,
          ipfsUrl: `ipfs://${cid}`,
          gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
        });
      } catch (metadataError) {
        results.push({
          index: i,
          success: false,
          error: metadataError.message,
        });
      }
    }

    const successfulUploads = results.filter((r) => r.success).length;
    console.log(
      `✅ Lote de ${successfulUploads}/${results.length} metadatas procesado`
    );

    res.json({
      success: true,
      totalMetadatas: results.length,
      successfulUploads: successfulUploads,
      failedUploads: results.length - successfulUploads,
      results,
    });
  } catch (error) {
    console.error("❌ Error en uploadBatchMetadata:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Controlador para verificar estado de Pinata
 * RUTA: GET /api/pinata/status
 */
export const getPinataStatus = async (req, res) => {
  try {
    console.log("🔍 Verificando estado de Pinata...");

    const status = await testPinataAuthentication();

    res.json({
      success: true,
      connected: true,
      status: "Pinata conectado correctamente",
      data: status,
      apiVersion: "v3",
    });
  } catch (error) {
    console.error("❌ Error en getPinataStatus:", error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message,
      apiVersion: "v3",
    });
  }
};

/**
 * Controlador para obtener información de un archivo
 * RUTA: GET /api/pinata/file-info/:cid
 */
export const getFileInfoController = async (req, res) => {
  try {
    const { cid } = req.params;
    console.log(`🔍 Obteniendo información para CID: ${cid}`);

    const fileInfo = await getFileInfo(cid);

    res.json({
      success: true,
      cid: cid,
      data: fileInfo,
    });
  } catch (error) {
    console.error("❌ Error en getFileInfo:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Controlador para crear URL firmada
 * RUTA: POST /api/pinata/signed-url
 */
export const createSignedURL = async (req, res) => {
  try {
    const { filename, expires, groupId } = req.body;
    console.log("🔗 Creando URL firmada...");

    const signedUrl = await createSignedUploadURL({
      filename: filename || `upload-${Date.now()}`,
      expires: expires || 30,
      groupId: groupId,
    });

    res.json({
      success: true,
      signedUrl: signedUrl,
      expiresIn: `${expires || 30} minutes`,
    });
  } catch (error) {
    console.error("❌ Error en createSignedURL:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
