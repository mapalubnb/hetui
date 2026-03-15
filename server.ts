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

    try {
      // Try the standard OpenAI v1 path first
      const targetUrl = 'https://api.jiekou.ai/openai/v1/chat/completions';
      console.log(`Proxying request to: ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(req.body),
      });

      if (response.status === 404) {
        console.warn("404 detected on /v1 path, trying alternative path...");
        // Fallback to the exact path provided in the user's guide
        const fallbackUrl = 'https://api.jiekou.ai/openai/chat/completions';
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(req.body),
        });
        
        const data = await fallbackResponse.json();
        return res.status(fallbackResponse.status).json(data);
      }

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: { message: error.message || "Failed to proxy request to third-party API." } });
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
