import { hClient } from "../../utils/hederaClint.js";
import { supabase } from "../../utils/supabase.js";
import fetch from "node-fetch";
import {
  AccountId,
  TransferTransaction,
  NftId,
  TokenId,
  Hbar,
} from "@hashgraph/sdk";
import { decrypt } from "../../utils/crypto.js";

const MIRROR_NODE = "https://testnet.mirrornode.hedera.com";

export const buyNftController = async (req, res, next) => {
  try {
    console.log("🟢 [START] buyNftController called");
    console.log("📥 Request body:", req.body);

    const { tokenId, serial_number, buyerId } = req.body;

    if (!tokenId || !serial_number || !buyerId) {
      console.warn("⚠️ Missing parameters:", {
        tokenId,
        serial_number,
        buyerId,
      });
      return res.status(400).json({ error: "Missing parameters" });
    }

    const marketplaceId = hClient.getOperator().accountId.toString();
    console.log("🏪 Marketplace accountId:", marketplaceId);

    // 1. Buscar oferta en Supabase
    console.log("🔍 Buscando oferta en Supabase...");
    const { data: offers, error } = await supabase
      .from("offerts")
      .select("*")
      .eq("nft->>token_id", tokenId)
      .eq("nft->>serial_number", serial_number)
      .eq("status", "active")
      .eq("listed_steep", 2);

    if (error) {
      console.error("❌ Supabase query error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!offers || offers.length === 0) {
      console.warn("⚠️ Offer not found for NFT:", { tokenId, serial_number });
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offers[0];
    console.log("✅ Oferta encontrada:", offer);

    const priceHbar = Number(offer.price);
    const expectedTinybars = Hbar.from(priceHbar).toTinybars().toBigInt();
    console.log(
      "💰 Precio esperado:",
      priceHbar,
      "HBAR =",
      expectedTinybars,
      "tinybars"
    );

    // 2. Verificar pago buyer → marketplace
    console.log("🔎 Verificando transacciones del buyer...");
    const txRes = await fetch(
      `${MIRROR_NODE}/api/v1/accounts/${buyerId}?transactiontype=cryptotransfer&limit=10&order=desc`
    );
    const txData = await txRes.json();

    if (!txData.transactions || txData.transactions.length === 0) {
      console.warn(
        "⚠️ No se encontraron transacciones recientes para el buyer:",
        buyerId
      );
      return res.status(400).json({ error: "No recent buyer transactions" });
    }

    console.log(
      "📜 Últimas transacciones recibidas:",
      txData.transactions.length
    );

    const validTx = txData.transactions.find((tx, idx) => {
      console.log(`➡️ Revisando transacción #${idx + 1}:`, tx.transaction_id);

      if (tx.result !== "SUCCESS") {
        console.log("❌ Estado distinto de SUCCESS:", tx.result);
        return false;
      }

      const transfers = tx.transfers || [];
      const buyerTransfer = transfers.find(
        (t) => t.account === buyerId && BigInt(t.amount) < 0n
      );
      const marketTransfer = transfers.find(
        (t) => t.account === marketplaceId && BigInt(t.amount) > 0n
      );

      console.log("   🔹 BuyerTransfer:", buyerTransfer);
      console.log("   🔹 MarketTransfer:", marketTransfer);

      if (!buyerTransfer || -BigInt(buyerTransfer.amount) < expectedTinybars) {
        console.log("❌ Amount no coincide con el esperado.");
        return false;
      }

      const memoDecoded = Buffer.from(tx.memo_base64 || "", "base64").toString(
        "utf8"
      );
      console.log("   📝 Memo decodificado:", memoDecoded);

      try {
        const decryptedMemo = decrypt(memoDecoded);
        console.log("   🔐 Memo desencriptado:", decryptedMemo);
        console.log(
          "   🔄 Comparación con offer.id:",
          decryptedMemo === String(offer.id)
        );
        return decryptedMemo === String(offer.id);
      } catch (err) {
        console.error("❌ Error al desencriptar memo:", err.message);
        return false;
      }
    });

    if (!validTx) {
      console.warn(
        "⚠️ No se encontró ninguna transacción válida que cumpla amount + memo"
      );
      return res.status(400).json({
        error:
          "No valid payment found (amount or memo does not match the offer)",
      });
    }

    console.log("✅ Transacción válida encontrada:", validTx.transaction_id);

    // 3. Transferir NFT → buyer
    console.log("🚀 Iniciando transferencia de NFT...");
    const nftId = new NftId(TokenId.fromString(tokenId), Number(serial_number));
    const nftTransferTx = new TransferTransaction()
      .addNftTransfer(
        nftId,
        AccountId.fromString(marketplaceId),
        AccountId.fromString(buyerId)
      )
      .freezeWith(hClient);

    console.log("   ⏳ Ejecutando transacción NFT...");
    const nftTxResponse = await nftTransferTx.execute(hClient);
    const nftReceipt = await nftTxResponse.getReceipt(hClient);
    console.log("   📑 NFT Tx Receipt:", nftReceipt.status.toString());

    if (nftReceipt.status.toString() !== "SUCCESS") {
      console.error("❌ NFT transfer failed");
      return res.status(500).json({ error: "NFT transfer failed" });
    }

    // 4. Transferir HBAR → seller (95%)
    console.log("💸 Iniciando transferencia de HBAR...");
    const sellerAmount = (expectedTinybars * 95n) / 100n;
    const commission = expectedTinybars - sellerAmount;
    console.log("   💵 SellerAmount:", sellerAmount.toString(), "tinybars");
    console.log(
      "   💵 Comisión marketplace:",
      commission.toString(),
      "tinybars"
    );

    const sellerTransferTx = new TransferTransaction()
      .addHbarTransfer(
        AccountId.fromString(marketplaceId),
        Hbar.fromTinybars(-expectedTinybars)
      )
      .addHbarTransfer(
        AccountId.fromString(offer.seller),
        Hbar.fromTinybars(sellerAmount)
      )
      .addHbarTransfer(
        AccountId.fromString(marketplaceId),
        Hbar.fromTinybars(commission)
      )
      .freezeWith(hClient);

    console.log("   ⏳ Ejecutando transacción HBAR...");
    const sellerTxResponse = await sellerTransferTx.execute(hClient);
    const sellerReceipt = await sellerTxResponse.getReceipt(hClient);
    console.log("   📑 Seller Tx Receipt:", sellerReceipt.status.toString());

    if (sellerReceipt.status.toString() !== "SUCCESS") {
      console.error("❌ HBAR transfer to seller failed");
      return res.status(500).json({ error: "HBAR transfer to seller failed" });
    }

    // 5. Actualizar oferta en Supabase
    console.log("🛠️ Actualizando oferta en Supabase...");
    const { error: updateError } = await supabase
      .from("offerts")
      .update({
        status: "inactive",
        buyer: buyerId,
        sold_at: new Date().toISOString(),
        update_at: new Date().toISOString(),
      })
      .eq("id", offer.id);

    if (updateError) {
      console.error("❌ Error al actualizar Supabase:", updateError.message);
      return res.status(500).json({ error: updateError.message });
    }

    console.log("✅ Oferta actualizada correctamente en Supabase");

    console.log("🎉 [SUCCESS] Proceso de compra finalizado con éxito");

    return res.status(200).json({
      success: true,
      message: "✅ NFT successfully purchased",
      nftTxId: nftTxResponse.transactionId.toString(),
      sellerTxId: sellerTxResponse.transactionId.toString(),
    });
  } catch (e) {
    console.error("❌ [ERROR] buyNftController:", e);
    return res.status(500).json({ error: e.message });
  }
};
