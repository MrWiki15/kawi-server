const { configureHederaClient } = require("../lib/hedera");
const supabase = require("../lib/supabase");
const axios = require("axios"); // Asegúrate de instalar axios: npm install axios

module.exports = async (req, res) => {
  // Configuración de CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tokenId, serialNumber, sellerAccountId, buyerAccountId, offerId } =
      req.body;

    // Validaciones
    if (
      !tokenId ||
      !serialNumber ||
      !sellerAccountId ||
      !buyerAccountId ||
      !offerId
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: tokenId, serialNumber, sellerAccountId, buyerAccountId, offerId",
      });
    }

    const accountIdRegex = /^\d+\.\d+\.\d+$/;
    if (
      !accountIdRegex.test(sellerAccountId) ||
      !accountIdRegex.test(buyerAccountId)
    ) {
      return res.status(400).json({
        error: "Invalid account ID format",
      });
    }

    // Configurar cliente de Hedera
    let client;
    try {
      client = configureHederaClient();
    } catch (error) {
      console.error("Hedera client configuration error:", error);
      return res.status(500).json({
        error: "Failed to configure Hedera client: " + error.message,
      });
    }

    // Obtener accountId del operador (marketplace)
    const operatorAccountId = client.operatorAccountId.toString();

    //1. VERIFICAR ALLOWANCE USANDO MIRROR NODE
    // try {
    //   // Usar testnet o mainnet según corresponda
    //   const mirrorNodeUrl = "https://mainnet.mirrornode.hedera.com";
    //   const allowanceUrl = `${mirrorNodeUrl}/api/v1/accounts/${sellerAccountId}/allowances/nfts`;

    //   console.log("Consultando allowances desde:", allowanceUrl);

    //   const response = await axios.get(allowanceUrl);
    //   const allowances = response.data.allowances || [];

    //   // Buscar allowance específico para este NFT
    //   const hasAllowance = allowances.some((allowance) => {
    //     const isTokenMatch = allowance.token_id === tokenId;
    //     const isSpenderMatch = allowance.spender === operatorAccountId;
    //     const hasSerial =
    //       allowance.serial_numbers &&
    //       allowance.serial_numbers.includes(Number(serialNumber));
    //     const isApprovedForAll = allowance.approved_for_all === true;

    //     return (
    //       isTokenMatch && isSpenderMatch && (hasSerial || isApprovedForAll)
    //     );
    //   });

    //   if (!hasAllowance) {
    //     return res.status(400).json({
    //       error:
    //         "Marketplace no tiene permisos para transferir este NFT. El allowance no existe o ha sido revocado.",
    //       details: {
    //         tokenId,
    //         serialNumber,
    //         sellerAccountId,
    //         operatorAccountId,
    //       },
    //     });
    //   }

    //   console.log("Allowance verificado correctamente");
    // } catch (allowanceError) {
    //   console.error("Error verificando allowance:", allowanceError);
    //   return res.status(500).json({
    //     error:
    //       "Error verificando permisos de transferencia: " +
    //       allowanceError.message,
    //   });
    // }

    //2. PROCEDER CON LA TRANSFERENCIA

    const {
      TransferTransaction,
      AccountId,
      TokenId,
      NftId,
      Hbar,
    } = require("@hashgraph/sdk");

    const nftId = new NftId(
      TokenId.fromString(tokenId),
      parseInt(serialNumber)
    );

    const transferTx = new TransferTransaction()
      .addApprovedNftTransfer(
        nftId,
        AccountId.fromString(sellerAccountId),
        AccountId.fromString(buyerAccountId)
      )
      .setMaxTransactionFee(new Hbar(30))
      .freezeWith(client);

    try {
      const transferTxSigned = await transferTx.execute(client);
      const transferRx = await transferTxSigned.getReceipt(client);

      if (transferRx.status.toString() !== "SUCCESS") {
        throw new Error(`NFT transfer failed: ${transferRx.status}`);
      }

      const transactionId = transferTxSigned.transactionId.toString();

      // Actualizar estado de la oferta en Supabase
      try {
        const { error: updateError } = await supabase
          .from("offerts")
          .update({
            status: "sold",
            buyer: buyerAccountId,
            sold_at: new Date().toISOString(),
            transaction_hash: transactionId,
          })
          .eq("id", offerId);

        if (updateError) {
          console.error("Error updating offer in Supabase:", updateError);
        }

        res.status(200).json({
          success: true,
          transactionId: transactionId,
          message: "NFT transferred successfully",
        });
      } catch (dbError) {
        console.error("Database update error:", dbError);
        res.status(200).json({
          success: true,
          transactionId: transactionId,
          message: "NFT transferred but database update failed",
          warning: dbError.message,
        });
      }
    } catch (hederaError) {
      console.error("Hedera transaction error:", hederaError);

      if (hederaError.message.includes("INSUFFICIENT_ACCOUNT_BALANCE")) {
        return res.status(400).json({
          error:
            "Insufficient balance in marketplace account to pay transaction fees",
        });
      }

      if (hederaError.message.includes("INVALID_SIGNATURE")) {
        return res.status(400).json({
          error: "Invalid signature. Check marketplace operator credentials",
        });
      }

      throw hederaError;
    }
  } catch (error) {
    console.error("Error in transferNFT:", error);
    res.status(500).json({
      error: error.message || "Failed to transfer NFT",
    });
  }
};
