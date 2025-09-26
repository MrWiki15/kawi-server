export const healthController = async (req, res, next) => {
  res.status(200).json({
    status: "OK",
    message: "NFT Marketplace API is running",
    timestamp: new Date().toISOString(),
  });
};
