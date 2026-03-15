import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Proxy for Jiekou Gemini
  app.post("/api/chat", async (req, res) => {
    const apiKey = process.env.JIEKOU_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "JIEKOU_API_KEY is not configured in environment variables." });
    }

    try {
      const response = await axios.post(
        "https://api.jiekou.ai/openai/chat/completions",
        {
          model: "gemini-2.5-flash",
          ...req.body,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
