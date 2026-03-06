import express, { Request, Response } from "express";
import { identifyContact } from "./identify.service";
import type { IdentifyRequest } from "./types";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "Bitespeed Identity Reconciliation API" });
});

app.post("/identify", async (req: Request, res: Response) => {
  try {
    const body = req.body as IdentifyRequest;
    const { email, phoneNumber } = body;

    const result = await identifyContact(email, phoneNumber);
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("required") ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`POST /identify - Identity reconciliation endpoint`);
});
