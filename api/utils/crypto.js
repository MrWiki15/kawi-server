import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.CRYPTO_KEY) {
  throw new Error("❌ CRYPTO_KEY no está definida en .env");
}

// 🔑 Key de 32 bytes
const key = crypto.createHash("sha256").update(process.env.CRYPTO_KEY).digest();
console.log("Key de encriptación cargada correctamente");

export const encrypt = (text) => {
  const iv = crypto.randomBytes(16); // IV = 16 bytes
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

  // 🔒 concatenamos IV + ciphertext y lo codificamos en base64url
  const combined = Buffer.concat([iv, encrypted]).toString("base64url");

  return combined;
};

export const decrypt = (encoded) => {
  const data = Buffer.from(encoded, "base64url");

  // 🪓 separar IV y ciphertext
  const iv = data.subarray(0, 16); // primeros 16 bytes
  const encrypted = data.subarray(16);

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
};
