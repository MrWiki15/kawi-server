// server/api/utils/pinata.js  (ESM)
import axios from "axios";
import FormData from "form-data";

const PINATA_JWT = process.env.PINATA_JWT;

if (!PINATA_JWT) {
  throw new Error("❌ ERROR: La variable de entorno PINATA_JWT es requerida");
}

// Helper para extraer info útil del error Axios/fetch
const extractErrorInfo = (err) => {
  if (!err) return String(err);
  if (err.response) {
    return {
      status: err.response.status,
      data: err.response.data,
      headers: err.response.headers,
      message: err.message,
    };
  }
  return { message: err.message || String(err) };
};

/**
 * Subir archivo a Pinata IPFS usando la API v3 (Node-friendly)
 * @param {Buffer|Stream} fileData - Buffer o Readable stream
 * @param {string} filename
 * @param {Object} options - { mimeType, network, name, keyvalues, groupId }
 * @returns {Promise<string>} CID
 */

export const uploadFileToPinata = async (fileData, filename, options = {}) => {
  try {
    if (!fileData) throw new Error("fileData es requerido");
    if (!filename) throw new Error("filename es requerido");

    const form = new FormData();

    // fileData debe ser Buffer o Readable stream (multer entrega Buffer)
    form.append("file", fileData, {
      filename,
      contentType: options.mimeType || "application/octet-stream",
    });

    form.append("network", options.network || "public");

    if (options.name) form.append("name", options.name);

    // --- Normalizar keyvalues: TODOS los values a string ---
    if (options.keyvalues && typeof options.keyvalues === "object") {
      const kv = {};
      Object.entries(options.keyvalues).forEach(([k, v]) => {
        // convierte undefined/null a cadena vacía si lo prefieres
        kv[k] = v === undefined || v === null ? "" : String(v);
      });
      form.append("keyvalues", JSON.stringify(kv));
    }

    if (options.groupId) form.append("group_id", options.groupId);

    const headers = {
      ...form.getHeaders(),
      Authorization: `Bearer ${PINATA_JWT}`,
    };

    const response = await axios.post(
      "https://uploads.pinata.cloud/v3/files",
      form,
      {
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 120000,
      }
    );

    if (!response?.data?.data?.cid) {
      throw new Error(
        `Respuesta inesperada de Pinata: ${JSON.stringify(response.data)}`
      );
    }

    return response.data.data.cid;
  } catch (err) {
    console.error(
      "Error uploading to Pinata v3:",
      err.response
        ? { status: err.response.status, data: err.response.data }
        : err
    );
    // devuelve mensaje legible al controlador
    const status = err.response?.status;
    const data = err.response?.data;
    throw new Error(
      data?.error?.message
        ? `Pinata: ${data.error.message}`
        : `Error subiendo a Pinata: status ${status || "n/a"}`
    );
  }
};

/**
 * Subir JSON (se envía como archivo .json)
 */
export const uploadJSONToPinata = async (
  jsonData,
  name = `upload-${Date.now()}`,
  options = {}
) => {
  const filename = `${name}.json`;
  const buffer = Buffer.from(JSON.stringify(jsonData));
  return await uploadFileToPinata(buffer, filename, {
    ...options,
    mimeType: "application/json",
    name: filename,
  });
};

/**
 * Testear autenticación: pedimos una lista muy corta (endpoint documentado)
 */
export const testPinataAuthentication = async () => {
  try {
    // Limit=1 para respuesta ligera
    const url = "https://api.pinata.cloud/v3/files/public?limit=1";
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      timeout: 10000,
    });

    // Si no hay error, el token funciona para listar archivos públicos
    return response.data;
  } catch (err) {
    const info = extractErrorInfo(err);
    console.error("Error testPinataAuthentication:", info);
    if (info.status === 401 || info.status === 403) {
      throw new Error("Token inválido o sin permisos para Pinata");
    }
    throw new Error(
      `Error de autenticación con Pinata: ${JSON.stringify(info)}`
    );
  }
};

/**
 * Obtener información de un archivo por CID (network: public|private)
 */
export const getFileInfo = async (cid, network = "public") => {
  try {
    if (!cid) throw new Error("cid es requerido");
    const url = `https://api.pinata.cloud/v3/files/${network}/${cid}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    const info = extractErrorInfo(err);
    console.error("Error getFileInfo:", info);
    throw new Error(
      `Error obteniendo información del archivo: ${JSON.stringify(info)}`
    );
  }
};

/**
 * Crear URL firmada para subida desde el cliente
 */
export const createSignedUploadURL = async (options = {}) => {
  try {
    const payload = {
      network: options.network || "public",
      expires: options.expires || 30,
      filename: options.filename || `upload-${Date.now()}`,
      group_id: options.groupId || null,
    };

    const response = await axios.post(
      "https://uploads.pinata.cloud/v3/files/sign",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        timeout: 10000,
      }
    );

    if (!response?.data?.data?.url) {
      throw new Error(
        `Respuesta inesperada al crear URL firmada: ${JSON.stringify(
          response.data
        )}`
      );
    }

    return response.data.data.url;
  } catch (err) {
    const info = extractErrorInfo(err);
    console.error("Error createSignedUploadURL:", info);
    throw new Error(`Error creando URL firmada: ${JSON.stringify(info)}`);
  }
};
