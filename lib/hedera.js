const { Client, PrivateKey, AccountId } = require("@hashgraph/sdk");

// Configurar cliente de Hedera para Vercel Edge Functions
const configureHederaClient = () => {
  // Usar variables de entorno de Vercel
  const hederaNetwork = process.env.HEDERA_NETWORK || "testnet";
  const operatorId = process.env.MARKETPLACE_OPERATOR_ID;
  const operatorKey = process.env.MARKETPLACE_OPERATOR_PK;

  console.log("HEDERA_NETWORK:", hederaNetwork);
  console.log("MARKETPLACE_OPERATOR_ID:", operatorId);
  console.log("MARKETPLACE_OPERATOR_PK:", operatorKey);

  if (!operatorId || !operatorKey) {
    throw new Error("Missing Hedera operator credentials");
  }

  let client;
  if (hederaNetwork === "testnet") {
    client = Client.forTestnet();
  } else if (hederaNetwork === "mainnet") {
    client = Client.forMainnet();
  } else {
    throw new Error("HEDERA_NETWORK must be set to 'testnet' or 'mainnet'");
  }

  // Configurar cuenta operadora del marketplace
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  return client;
};

module.exports = { configureHederaClient };
