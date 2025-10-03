import { hClient } from "../../utils/hederaClint.js";
import { supabase } from "../../utils/supabase.js";
import { TransferTransaction, Hbar, AccountId, TokenId } from "@hashgraph/sdk";
import { operatorKey } from "../createController/createController.js";

// Helper para obtener los seriales NFT de la cuenta del mercado usando Mirror Node
async function getNftSerialsForAccount(accountId, tokenId) {
  let serials = [];
  let next = null;
  const baseUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}&limit=100`;
  let page = 0;

  do {
    const url = next ? `https://testnet.mirrornode.hedera.com${next}` : baseUrl;
    page += 1;
    console.log(`🔎 MirrorNode page ${page}: ${url}`);
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.nfts && Array.isArray(data.nfts)) {
      serials.push(...data.nfts.map((nft) => nft.serial_number));
      console.log(
        `📦 Page ${page} items: ${data.nfts.length} | total so far: ${serials.length}`
      );
    }
    next = data.links && data.links.next ? data.links.next : null;
  } while (next);

  console.log(`✅ MirrorNode fetch done. Total serials: ${serials.length}`);
  return serials;
}

export const mintLaunchpadController = async (req, res) => {
  try {
    const { accountId, token_id, amount } = req.body;
    const amountNumber = Number(amount);
    const treasuryId = "0.0.6884661"; // ID del mercado/tesorería
    console.log("\n🧾 Mint recibido");
    console.log("👤 Account ID: ", accountId);
    console.log("🪙 Token ID: ", token_id);
    console.log("#️⃣ Amount (raw): ", amount, "| parsed:", amountNumber);

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      console.log("❌ Validación fallida: amount inválido ->", amount);
      return res.status(400).json({
        success: false,
        error: "El monto 'amount' debe ser un número positivo.",
      });
    }

    // 1. Obtener los seriales NFT disponibles en la cuenta del mercado
    const allSerials = await getNftSerialsForAccount(treasuryId, token_id);
    console.log("📚 Seriales disponibles en treasury:", allSerials.length);
    console.log("🧩 Muestra de seriales:", allSerials.slice(0, 10));

    if (allSerials.length < amountNumber) {
      console.log(
        `❌ No hay suficientes NFTs. requeridos=${amountNumber} disponibles=${allSerials.length}`
      );
      return res.status(400).json({
        success: false,
        error: "No hay suficientes NFTs disponibles para transferir.",
      });
    }

    // 2. Seleccionar los seriales a transferir
    const serialsToTransfer = allSerials.slice(0, amountNumber);
    const batchSize = 10;
    const totalBatches = Math.ceil(serialsToTransfer.length / batchSize);
    console.log(
      `🚚 Preparando transferencias | total NFTs=${serialsToTransfer.length} | batchSize=${batchSize} | batches=${totalBatches}`
    );

    for (let i = 0; i < serialsToTransfer.length; i += batchSize) {
      const batchSerials = serialsToTransfer.slice(i, i + batchSize);
      const transferTx = new TransferTransaction();

      console.log(
        `📦 Armando batch ${i / batchSize + 1}/${totalBatches} | seriales:`,
        batchSerials
      );
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
        console.log(
          `🛑 Falla en batch ${i / batchSize + 1}:`,
          transferReceipt.status.toString()
        );
        return res.status(500).json({
          success: false,
          error: `Error al transferir NFTs en el batch ${i / batchSize + 1}`,
        });
      }

      console.log(
        `✅ Batch ${i / batchSize + 1}/${totalBatches} transferido | cantidad=${
          batchSerials.length
        } | status=${transferReceipt.status.toString()} | txId=${transferResponse?.transactionId?.toString?.()}`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Actualizar los estados en Supabase: participantes, minted, total_raised y status si corresponde
    // Primero, obtener los datos actuales del launchpad
    const { data: launchpadData, error: fetchError } = await supabase
      .from("launchpads")
      .select("participants, minted, total_raised, goal, status, price")
      .eq("token_id", token_id)
      .single();

    if (fetchError || !launchpadData) {
      console.log("🛑 Supabase fetch error:", fetchError);
      console.log("🧩 launchpadData:", launchpadData);
      return res.status(500).json({
        success: false,
        error: "No se pudo obtener la información del launchpad.",
      });
    }

    console.log("🗄️ Supabase datos actuales:", {
      participants: launchpadData.participants,
      minted: launchpadData.minted,
      total_raised: launchpadData.total_raised,
      goal: launchpadData.goal,
      status: launchpadData.status,
      price: launchpadData.price,
      participants_type: Array.isArray(launchpadData.participants)
        ? "array"
        : typeof launchpadData.participants,
    });

    // Actualizar participantes (agregar si no existe)
    let nuevosParticipantes = launchpadData.participants || [];
    if (!nuevosParticipantes.includes(accountId)) {
      nuevosParticipantes.push(accountId);
    }
    console.log("👥 Participantes -> previo:", launchpadData.participants);
    console.log(
      "👥 Participantes -> nuevo array (en memoria):",
      nuevosParticipantes
    );

    // Actualizar minted y total_raised
    const nuevoMinted = (launchpadData.minted || 0) + amountNumber;
    // Suponiendo que el precio por NFT está en launchpadData.price
    const precioPorNft = launchpadData.price || 0;
    const nuevoTotalRaised =
      (launchpadData.total_raised || 0) + precioPorNft * amountNumber;
    console.log("📈 Cálculos:", {
      nuevoMinted,
      precioPorNft,
      amountNumber,
      nuevoTotalRaised,
    });

    // Verificar si se alcanzó el goal
    let nuevoStatus = launchpadData.status;
    if (launchpadData.goal && nuevoTotalRaised >= launchpadData.goal) {
      nuevoStatus = "ended";
    }
    console.log("🏁 Estado del launchpad:", {
      goal: launchpadData.goal,
      nuevoTotalRaised,
      statusPrevio: launchpadData.status,
      nuevoStatus,
    });

    // Actualizar en la base de datos
    const { error: updateError } = await supabase
      .from("launchpads")
      .update({
        // Guardar el conteo de participantes (columna integer)
        participants: nuevosParticipantes.length,
        minted: Number(nuevoMinted),
        total_raised: Number(nuevoTotalRaised),
        status: nuevoStatus,
      })
      .eq("token_id", token_id);
    console.log("📝 Payload UPDATE:", {
      participants: nuevosParticipantes.length,
      minted: Number(nuevoMinted),
      total_raised: Number(nuevoTotalRaised),
      status: nuevoStatus,
      token_id,
    });

    if (updateError) {
      console.log("🛑 Supabase update error:", updateError);
      return res.status(500).json({
        success: false,
        error: "No se pudo actualizar el estado del launchpad.",
      });
    }

    console.log("🎉 Mint finalizado con éxito", {
      accountId,
      token_id,
      transferidos: serialsToTransfer.length,
    });
    return res.status(200).json({
      success: true,
      message: "NFTs transferidos exitosamente.",
      serials: serialsToTransfer,
    });
  } catch (error) {
    console.error("💥 Error inesperado en mintLaunchpadController:", error);
    return res.status(500).json({
      success: false,
      error: "Error interno al transferir NFTs.",
    });
  }
};
