import { hClient } from "../../utils/hederaClint.js";
import { supabase } from "../../utils/supabase.js";
import { AccountId, TransferTransaction, TokenId, NftId } from "@hashgraph/sdk";
import fetch from "node-fetch";
import { decrypt } from "../../utils/crypto.js"; // 👈 tu función decrypt

export const deslitNftController = async (req, res, next) => {
  try {
    const marketplaceId = hClient.getOperator().accountId.toString();
    const { tokenId, serial_number, owner } = req.body;

    // 1. Verificar que el NFT está en la cuenta del marketplace
    const nftInfoResp = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}/nfts/${serial_number}`
    );
    if (!nftInfoResp.ok) {
      return res
        .status(400)
        .json({ error: "No se pudo obtener información del NFT" });
    }
    const nftInfo = await nftInfoResp.json();
    if (nftInfo.account_id !== marketplaceId) {
      return res
        .status(400)
        .json({ error: "El NFT no está en el marketplace" });
    }

    // 2. Verificar que el usuario listó el NFT en Supabase
    const { data: offers, error: supaError } = await supabase
      .from("offerts")
      .select("*")
      .eq("nft->>token_id", tokenId)
      .eq("nft->>serial_number", serial_number.toString())
      .eq("status", "active")
      .eq("seller", owner)
      .eq("listed_steep", 2);

    if (supaError) throw new Error(`Error Supabase: ${supaError.message}`);
    if (!offers || offers.length === 0) {
      return res
        .status(404)
        .json({ error: "No existe oferta activa para este NFT" });
    }

    const offer = offers[0];
    if (offer.seller !== owner) {
      return res
        .status(403)
        .json({ error: "El usuario no es el creador de la oferta" });
    }

    // 3. Verificar última transferencia
    const txHistoryResp = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}/nfts/${serial_number}/transactions?order=desc&limit=1`
    );
    if (!txHistoryResp.ok) {
      return res
        .status(400)
        .json({ error: "No se pudo obtener historial de transacciones" });
    }
    const txHistory = await txHistoryResp.json();
    const lastTx = txHistory.transactions[0];
    if (
      !lastTx ||
      lastTx.type !== "CRYPTOTRANSFER" ||
      lastTx.receiver_account_id !== marketplaceId ||
      lastTx.sender_account_id !== owner
    ) {
      return res.status(400).json({
        error:
          "La última transferencia no corresponde al usuario -> marketplace",
      });
    }

    // 3.2. Verificar memo de la transacción
    const txDetailResp = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/transactions/${lastTx.transaction_id}`
    );
    if (!txDetailResp.ok) {
      return res
        .status(400)
        .json({ error: "No se pudo obtener detalles de la transacción" });
    }
    const txDetail = await txDetailResp.json();

    const memoBase64 = txDetail.transactions[0]?.memo_base64;
    if (!memoBase64) {
      return res.status(400).json({ error: "La transacción no contiene memo" });
    }

    const memoDecoded = Buffer.from(memoBase64, "base64").toString("utf8");
    let memoDecrypted;
    try {
      memoDecrypted = decrypt(memoDecoded);
    } catch (err) {
      return res.status(400).json({ error: "Error al desencriptar el memo" });
    }

    if (memoDecoded !== offer.memo_id) {
      return res.status(400).json({
        error: "El memo de la transacción no coincide con el de la oferta",
      });
    }

    // validar memo desencriptado con el patrón esperado
    const randomPattern = /^[a-z0-9]{5,15}$/; // lo que suele dar Math.random().toString(36).substring(2, 15)
    const isMemoValid = memoDecrypted && randomPattern.test(memoDecrypted);

    if (!isMemoValid) {
      return res.status(400).json({ error: "Memo no valido" });
    }

    // 4. Enviar el NFT de regreso al usuario
    const transferTx = await new TransferTransaction()
      .addNftTransfer(
        new NftId(TokenId.fromString(tokenId), Number(serial_number)),
        AccountId.fromString(marketplaceId),
        AccountId.fromString(owner)
      )
      .freezeWith(hClient)
      .execute(hClient);

    await transferTx.getReceipt(hClient);

    // 5. Actualizar oferta en Supabase -> inactive
    const { error: updateError } = await supabase
      .from("offerts")
      .update({ status: "inactive", update_at: new Date().toISOString() })
      .eq("id", offer.id);

    if (updateError)
      throw new Error(`Error al actualizar Supabase: ${updateError.message}`);

    res.status(200).json({
      success: true,
      message: "NFT deslistado y transferido correctamente",
    });
  } catch (error) {
    console.error("Error en deslitNftController:", error);
    res.status(500).json({ error: error.message });
  }
};
