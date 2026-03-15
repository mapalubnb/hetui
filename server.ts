import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: '50mb' }));

  // API Proxy Route
  app.post("/api/generate", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: { message: "Server configuration error: API Key missing." } });
    }

    const { model, messages, isGeminiProtocol } = req.body;

    try {
      if (isGeminiProtocol) {
        // Use Gemini Native Protocol
        const targetUrl = `https://api.jiekou.ai/gemini/v1/models/${model}:generateContent`;
        console.log(`Proxying to Gemini Native: ${targetUrl}`);
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(req.body.payload),
        });

        const data = await response.json();
        return res.status(response.status).json(data);
      } else {
        // Use OpenAI Protocol (Exact URL from docs)
        const targetUrl = 'https://api.jiekou.ai/openai/chat/completions';
        console.log(`Proxying to OpenAI Protocol: ${targetUrl}`);
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            reasoning_effort: "low"
          }),
        });

        const data = await response.json();
        if (response.status === 404) {
          console.error("OpenAI endpoint returned 404. Data:", data);
        }
        return res.status(response.status).json(data);
      }
    } catch (error: any) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: { message: error.message || "Failed to proxy request." } });
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
