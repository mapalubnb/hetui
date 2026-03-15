import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global middleware
  app.use(express.json({ limit: '20mb' }));
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // In-memory store for IP usage
  const ipUsage: Record<string, number> = {};
  const MAX_USAGE = 4;

  // API route for generation with rate limiting
  app.post("/api/generate", async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ipStr = Array.isArray(ip) ? ip[0] : ip || 'unknown';

    // Check usage
    const currentUsage = ipUsage[ipStr] || 0;
    if (currentUsage >= MAX_USAGE) {
      return res.status(429).json({ error: { message: "您已达到今日使用上限（每个IP限4次）。" } });
    }

    try {
      const { image, mimeType } = req.body;
      const API_KEY = process.env.GEMINI_API_KEY;

      if (!API_KEY) {
        throw new Error("服务器未配置 API Key");
      }

      // Step 1: Analyze image with gemini-2.5-flash
      const visionResponse = await fetch('https://api.jiekou.ai/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: "Describe the person in this image in detail (hair, facial features, clothing, expression). Then, based on this description, write a prompt for an AI image generator to create a minimalist black and white cartoon caricature of this person in a 'hetui' (spitting) pose: puffed cheeks, a curved line representing spit coming from the mouth, and one hand with the index finger pointing upwards. The style should be clean, bold lines, white background. Only return the final prompt for the image generator.",
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${image}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!visionResponse.ok) throw new Error("图片分析失败");
      const visionData: any = await visionResponse.json();
      const generatedPrompt = visionData.choices?.[0]?.message?.content;

      // Step 2: Generate image with gemini-3.1-flash-image
      const imageResponse = await fetch('https://api.jiekou.ai/v3/gemini-3.1-flash-image-text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          prompt: generatedPrompt + " Add the text 'He~~tui' at the bottom of the image.",
          size: "1K",
          google: { web_search: false, image_search: false },
          aspect_ratio: "1:1",
          output_format: "image/png"
        }),
      });

      if (!imageResponse.ok) throw new Error("图片生成失败");
      const imageData: any = await imageResponse.json();
      const imageUrl = imageData.image_urls?.[0] || imageData.url || imageData.image_url;

      if (!imageUrl) throw new Error("未获取到图片链接");

      // Increment usage count only on success
      ipUsage[ipStr] = currentUsage + 1;

      res.json({ imageUrl, remaining: MAX_USAGE - ipUsage[ipStr] });
    } catch (error: any) {
      console.error("Server Error:", error);
      res.status(500).json({ error: { message: error.message || "生成失败，请稍后重试。" } });
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
