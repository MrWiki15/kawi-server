import { Client, Hbar } from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

export const hClient = Client.forName("testnet".toLowerCase())
  .setOperator(
    "0.0.6884661", //Kawi admin
    "3030020100300706052b8104000a04220420de6ee0d0d8951648ad09977915f40a7b66ff96d3f74e63062a1fcd33b5171a2e"
  )
  .setMaxQueryPayment(new Hbar(3));
