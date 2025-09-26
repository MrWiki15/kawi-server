import {
  NftId,
  TokenId,
  TokenInfoQuery,
  TokenNftInfoQuery,
} from "@hashgraph/sdk";
import { supabase } from "../../utils/supabase.js";
import { hClient } from "../../utils/hederaClint.js";
import { decrypt } from "../../utils/crypto.js";

export const listNftController = async (req, res, next) => {
  const { tokenId, serial_number, owner, price, duration, nft, memo } =
    req.body;

  console.log("Iniciando listado de NFT:", { tokenId, serial_number, owner });

  try {
    const nftId = new NftId(TokenId.fromString(tokenId), Number(serial_number));
    const marketplaceAccountId = hClient.getOperator().accountId.toString();

    // 1. verificar que ninguna oferta ya existe con el mismo memo en sttep 2
    console.log(
      "Verificando existencia de ofertas con el mismo memo en steep 2..."
    );
    const existingOffersWithSameMemo = await supabase
      .from("offerts")
      .select("*")
      .eq("memo", memo)
      .eq("listed_steep", 2);

    if (existingOffersWithSameMemo?.length > 0) {
      return res
        .status(400)
        .json({ error: "Oferta con el mismo memo ya existe, :?" });
    }

    // 2. Verificar transferencia y propiedad
    console.log("Verificando transferencia...");
    let verification = await verifyNFTTransfer(
      tokenId,
      serial_number,
      marketplaceAccountId,
      owner,
      memo
    );

    if (!verification.success) {
      return res.status(400).json({ error: verification.error });
    }

    // 3. Registrar oferta
    console.log("Registrando oferta...");
    const offerResult = await createOfferRecord(nft, owner, memo);

    if (!offerResult.success) {
      throw new Error(offerResult.error);
    }

    res.status(200).json({
      success: true,
      message: "NFT listado exitosamente",
    });
  } catch (error) {
    console.error("Error en listNftController:", error);
    res.status(500).json({ error: error.message });
  }
};

async function verifyNFTTransfer(
  tokenId,
  serialNumber,
  marketplaceAccountId,
  previousOwnerId,
  expectedMemo
) {
  const baseUrl = "https://testnet.mirrornode.hedera.com/api/v1";

  // 1. Verificar owner actual
  const nftInfoUrl = `${baseUrl}/tokens/${tokenId}/nfts/${serialNumber}`;
  const nftInfoResp = await fetch(nftInfoUrl);
  if (!nftInfoResp.ok) {
    throw new Error("No se pudo obtener la información del NFT");
  }
  const nftInfo = await nftInfoResp.json();
  const currentOwner = nftInfo.account_id;

  // 2. Consultar historial de transacciones del NFT
  const txHistoryUrl = `${baseUrl}/tokens/${tokenId}/nfts/${serialNumber}/transactions?order=desc&limit=1`;
  const txHistoryResp = await fetch(txHistoryUrl);
  if (!txHistoryResp.ok) {
    throw new Error("No se pudo obtener el historial de transacciones del NFT");
  }
  const txHistory = await txHistoryResp.json();
  const lastTx = txHistory.transactions[0];
  if (!lastTx) {
    return { success: false, error: "No hay transacciones para este NFT" };
  }

  // 3. Obtener detalle de la transacción para leer el memo
  const txId = lastTx.transaction_id;
  const txDetailUrl = `${baseUrl}/transactions/${txId}`;
  const txDetailResp = await fetch(txDetailUrl);
  if (!txDetailResp.ok) {
    throw new Error("No se pudo obtener detalle de la transacción");
  }
  const txDetail = await txDetailResp.json();

  const memoBase64 = txDetail.transactions?.[0]?.memo_base64;

  let decryptedMemo = null;
  if (memoBase64) {
    const memoBuffer = Buffer.from(memoBase64, "base64");
    console.log("memo base64: ", memoBuffer);
    const encryptedMemo = memoBuffer.toString("utf8");
    console.log("memo cifrado: ", encryptedMemo);
    console.log("memo esperado: ", expectedMemo);

    if (encryptedMemo != expectedMemo.code) {
      return { success: false, error: "Error en el memo" };
    }
    try {
      decryptedMemo = decrypt(encryptedMemo);
      console.log("memo descifrado: ", decryptedMemo);
    } catch (e) {
      console.error("Error desencriptando memo:", e.message);
      return { success: false, error: "Error desencriptando memo" };
    }
  }

  // 4. Validar condiciones
  const isOwnerMarketplace = currentOwner === marketplaceAccountId;
  const isLastTransfer =
    lastTx.type === "CRYPTOTRANSFER" &&
    lastTx.receiver_account_id === marketplaceAccountId &&
    lastTx.sender_account_id === previousOwnerId;

  // validar memo desencriptado con el patrón esperado
  const randomPattern = /^[a-z0-9]{5,15}$/; // lo que suele dar Math.random().toString(36).substring(2, 15)
  const isMemoValid = decryptedMemo && randomPattern.test(decryptedMemo);
  console.log("isMemoValid: ", isMemoValid);

  if (!isMemoValid) {
    return { success: false, error: "Memo no valido" };
  }

  return {
    success: isOwnerMarketplace && isLastTransfer && isMemoValid,
    isOwnerMarketplace,
    isLastTransfer,
    isMemoValid,
    currentOwner,
    lastTx,
    decryptedMemo,
  };
}

// Función auxiliar para crear registro de oferta
async function createOfferRecord(nft, seller, memo) {
  const { error } = await supabase
    .from("offerts")
    .update({ listed_steep: 2 })
    .eq("nft->>token_id", nft.token_id)
    .eq("nft->>serial_number", nft.serial_number)
    .eq("seller", seller)
    .eq("memo_id", memo.code);

  if (error) {
    return {
      success: false,
      error: error.message,
      explication: "ocurrio un error al actualizar el sttep en el backend",
    };
  }

  return { success: true };
}
