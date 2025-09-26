import { encrypt } from "../../utils/crypto.js";

export const codeNftController = async (req, res, next) => {
  try {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    const { id, date, ms } = req.body;

    if (!id || !date) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    //verificar que el id sea un numero
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    //vericar que la fecha sea una fecha valida
    if (!isoDateRegex.test(date)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    let _;

    if (!ms) {
      _ = Math.random().toString(36).substring(2, 15);
      console.log("codigo generado: ", _);
    } else {
      _ = ms;
    }

    const code = encrypt(`${_}`);
    res.status(200).json({ code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
