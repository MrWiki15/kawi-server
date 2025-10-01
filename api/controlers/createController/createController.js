import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  Hbar,
  PrivateKey,
  TokenMintTransaction,
  TokenId,
  TransferTransaction,
  AccountId,
} from "@hashgraph/sdk";
import { hClient } from "../../utils/hederaClint.js";
import { supabase } from "../../utils/supabase.js";

export const operatorKey = PrivateKey.fromString(
  "3030020100300706052b8104000a04220420de6ee0d0d8951648ad09977915f40a7b66ff96d3f74e63062a1fcd33b5171a2e"
);

export const createNFTCollectionController = async (req, res) => {
  try {
    const {
      generated,
      collectionName,
      accountId, // usuario final
      ipfsHashes,
      collectionMetadata,
    } = req.body;

    if (
      !generated ||
      !collectionName ||
      !accountId ||
      !ipfsHashes ||
      !collectionMetadata
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Faltan datos requeridos: generated, collectionName, accountId, ipfsHashes, collectionMetadata",
      });
    }

    if (!ipfsHashes.metadata || ipfsHashes.metadata.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No hay metadatas de NFTs para mintear",
      });
    }

    const supplyKey = PrivateKey.generateED25519();
    const metadataKey = PrivateKey.generateED25519();
    let tokenId;
    const mintHashes = [];
    const allSerials = [];

    // 1. Crear la colección NFT
    console.log("🏗️ Creando colección NFT...");
    const createTransaction = await new TokenCreateTransaction()
      .setTokenName(collectionName)
      .setTokenSymbol(
        collectionName.replace(/\s+/g, "").toUpperCase().substring(0, 4) ||
          "NFT"
      )
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(AccountId.fromString("0.0.6884661")) // El mercado es el tresuary
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(generated.length)
      .setMetadata(ipfsHashes.collection)
      .setMetadataKey(metadataKey.publicKey)
      .setSupplyKey(supplyKey.publicKey)
      .setMaxTransactionFee(new Hbar(5))
      .freezeWith(hClient);

    await createTransaction.sign(supplyKey);
    await createTransaction.sign(operatorKey);

    const createResponse = await createTransaction.execute(hClient);
    const createReceipt = await createResponse.getReceipt(hClient);

    if (!createReceipt.tokenId) {
      return res.status(500).json({
        success: false,
        error: "No se pudo obtener el Token ID",
      });
    }

    tokenId = createReceipt.tokenId.toString();
    console.log("✅ Colección creada:", tokenId);

    // 2. Mintear NFTs por lotes
    console.log("🎨 Minteando NFTs...");
    const batchSize = 10;
    const totalNFTs = ipfsHashes.metadata.length;

    for (let i = 0; i < totalNFTs; i += batchSize) {
      try {
        const batchEnd = Math.min(i + batchSize, totalNFTs);
        const batchMetadatas = ipfsHashes.metadata
          .slice(i, batchEnd)
          .map((metadataCid) => new TextEncoder().encode(metadataCid));

        const mintTx = await new TokenMintTransaction()
          .setTokenId(TokenId.fromString(tokenId))
          .setMetadata(batchMetadatas)
          .setMaxTransactionFee(new Hbar(2 * batchMetadatas.length))
          .freezeWith(hClient);

        const signedTx = await mintTx.sign(supplyKey);
        const mintResponse = await signedTx.execute(hClient);
        const mintReceipt = await mintResponse.getReceipt(hClient);

        const serials = mintReceipt.serials
          ? mintReceipt.serials.map((s) => s.toString())
          : [];
        allSerials.push(...serials);

        mintHashes.push({
          transactionId: mintResponse.transactionId.toString(),
          serials,
          batch: `NFTs ${i + 1}-${batchEnd}`,
        });

        console.log(
          `✅ Batch ${i / batchSize + 1} minteado:`,
          serials.length,
          "NFTs"
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (batchError) {
        console.error(`❌ Error en batch ${i / batchSize + 1}:`, batchError);
        continue;
      }
    }

    // 3. Transferir NFTs al usuario final por batches de 10
    console.log("🚚 Transfiriendo NFTs al usuario...");
    for (let i = 0; i < allSerials.length; i += batchSize) {
      const batchSerials = allSerials.slice(i, i + batchSize);
      const transferTx = new TransferTransaction();

      batchSerials.forEach((serial) => {
        transferTx.addNftTransfer(
          TokenId.fromString(tokenId),
          Number(serial),
          AccountId.fromString("0.0.6884661"), // desde el treasury (mercado)
          accountId // hacia el usuario final
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

    try {
      await supabase.from("collections").insert({
        token_id: tokenId,
        owner: accountId,
      });
    } catch (error) {
      console.error("❌ Error en createNFTCollectionController:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        step: "create-collection",
      });
    }

    // 4. Retornar resultado exitoso
    res.json({
      success: true,
      tokenId: tokenId,
      collectionName: collectionName,
      totalNFTs: totalNFTs,
      mintedNFTs: mintHashes.reduce(
        (total, batch) => total + (batch.serials?.length || 0),
        0
      ),
      mintBatches: mintHashes,
      supplyKey: supplyKey.toStringRaw(), // Solo para desarrollo, en producción no exponer
      ipfsCollection: ipfsHashes.collection,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error en createNFTCollectionController:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      step: "create-collection",
    });
  }
};

export const createNFTLaunchpadController = async (req, res) => {
  try {
    const { token_id, accountId, ammount } = req.body;

    if (!token_id || !accountId || !ammount || Number(ammount) <= 0) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos: token_id, accountId, ammount (>0)",
      });
    }

    const amountToTransfer = Number(ammount);

    // 1) Obtener los serials del usuario desde Mirror Node
    const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?token.id=${encodeURIComponent(
      token_id
    )}&limit=1000`;

    const resp = await fetch(mirrorUrl);
    if (!resp.ok) {
      return res.status(502).json({
        success: false,
        error: "No se pudo consultar Mirror Node para los NFTs del usuario",
      });
    }
    const data = await resp.json();
    const userSerials = (data?.nfts || [])
      .filter((n) => n?.token_id === token_id)
      .map((n) => Number(n.serial_number));

    if (userSerials.length < amountToTransfer) {
      return res.status(400).json({
        success: false,
        error: `El usuario no tiene suficientes NFTs. Tiene ${userSerials.length}, requiere ${amountToTransfer}.`,
      });
    }

    // 2) Preparar transferencia al treasury (mercado) usando allowance
    const operatorKey = PrivateKey.fromString(
      "3030020100300706052b8104000a04220420de6ee0d0d8951648ad09977915f40a7b66ff96d3f74e63062a1fcd33b5171a2e"
    );
    const treasuryId = AccountId.fromString("0.0.6884661");

    // Por seguridad, hacer transferencias en lotes
    const batchSize = 10;
    const selectedSerials = userSerials.slice(0, amountToTransfer);

    for (let i = 0; i < selectedSerials.length; i += batchSize) {
      const batch = selectedSerials.slice(i, i + batchSize);

      const transferTx = new TransferTransaction();
      batch.forEach((serial) => {
        transferTx.addApprovedNftTransfer(
          TokenId.fromString(token_id),
          Number(serial),
          AccountId.fromString(accountId),
          treasuryId
        );
      });

      await transferTx.freezeWith(hClient);
      await transferTx.sign(operatorKey);

      const exec = await transferTx.execute(hClient);
      const receipt = await exec.getReceipt(hClient);

      const statusText = receipt.status?.toString?.() || "UNKNOWN";
      if (!statusText.includes("SUCCESS")) {
        return res.status(500).json({
          success: false,
          error: `Error al transferir NFTs (batch ${
            i / batchSize + 1
          }): ${statusText}`,
        });
      }

      // Breve pausa para evitar rate limit
      await new Promise((r) => setTimeout(r, 1000));
    }

    return res.json({
      success: true,
      token_id,
      transferred: amountToTransfer,
      to: treasuryId.toString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error en createNFTLaunchpadController:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      step: "create-launchpad",
    });
  }
};
