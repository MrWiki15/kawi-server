import { hClient } from "../../utils/hederaClint";
import { supabase } from "../../utils/supabase";
import { TransferTransaction, Hbar, AccountId, TokenId } from "@hashgraph/sdk";
import { operatorKey } from "../createController/createController";

// Helper para obtener los seriales NFT de la cuenta del mercado usando Mirror Node
async function getNftSerialsForAccount(accountId, tokenId) {
  let serials = [];
  let next = null;
  const baseUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}&limit=100`;

  do {
    const url = next ? `https://testnet.mirrornode.hedera.com${next}` : baseUrl;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.nfts && Array.isArray(data.nfts)) {
      serials.push(...data.nfts.map((nft) => nft.serial_number));
    }
    next = data.links && data.links.next ? data.links.next : null;
  } while (next);

  return serials;
}

export const mintLaunchpadController = async (req, res) => {
  try {
    const { accountId, token_id, amount } = req.body;
    const treasuryId = "0.0.6884661"; // ID del mercado/tesorería

    // 1. Obtener los seriales NFT disponibles en la cuenta del mercado
    const allSerials = await getNftSerialsForAccount(treasuryId, token_id);

    if (allSerials.length < amount) {
      return res.status(400).json({
        success: false,
        error: "No hay suficientes NFTs disponibles para transferir.",
      });
    }

    // 2. Seleccionar los seriales a transferir
    const serialsToTransfer = allSerials.slice(0, amount);
    const batchSize = 10;

    console.log("🚚 Transfiriendo NFTs al usuario debido a mint...");

    for (let i = 0; i < serialsToTransfer.length; i += batchSize) {
      const batchSerials = serialsToTransfer.slice(i, i + batchSize);
      const transferTx = new TransferTransaction();

      batchSerials.forEach((serial) => {
        transferTx.addNftTransfer(
          TokenId.fromString(token_id),
          Number(serial),
          AccountId.fromString(treasuryId), // desde el treasury (mercado)
          AccountId.fromString(accountId) // hacia el usuario final
        );
      });

      await transferTx.freezeWith(hClient);
      await transferTx.sign(operatorKey);

      const transferResponse = await transferTx.execute(hClient);
      const transferReceipt = await transferResponse.getReceipt(hClient);

      if (!transferReceipt.status.toString().includes("SUCCESS")) {
        return res.status(500).json({
          success: false,
          error: `Error al transferir NFTs en el batch ${i / batchSize + 1}`,
        });
      }

      console.log(
        `NFTs transferidos en batch ${i / batchSize + 1}:`,
        batchSerials.length,
        transferReceipt.status.toString()
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    //actualizar supabase
    await supabase.from("launchpads").update({
      stats, //actualiza las stats ademas de participants minted and total_raised y si el total raised total es igual al goal, entonces cambia el status a ended
    });

    return res.status(200).json({
      success: true,
      message: "NFTs transferidos exitosamente.",
      serials: serialsToTransfer,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: "Error interno al transferir NFTs.",
    });
  }
};
