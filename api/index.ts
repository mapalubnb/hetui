import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_API_ENDPOINT = 'https://api.jiekou.ai/openai/chat/completions';
const IMAGE_API_ENDPOINT = 'https://api.jiekou.ai/v3/gemini-3.1-flash-image-text-to-image';
const API_KEY = process.env.GEMINI_API_KEY || '';

// In-memory IP tracking
const ipLimits: Record<string, number> = {};
const MAX_USES = 10;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  app.get("/api/test-key", (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    res.json({ 
      hasKey: !!key, 
      keyLength: key?.length || 0,
      prefix: key ? key.substring(0, 4) : null
    });
  });

  // API routes FIRST - use .all to handle method checks manually for better debugging
  app.all(["/api/generate", "/api/generate/"], async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed. Please use POST." });
    }

    try {
      const ip = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress;
      const ipStr = Array.isArray(ip) ? ip[0] : (typeof ip === 'string' ? ip : 'unknown');
      console.log(`Request from IP: ${ipStr}, Current Uses: ${ipLimits[ipStr] || 0}`);

      // Check limit
      const currentUses = ipLimits[ipStr] || 0;
      if (currentUses >= MAX_USES) {
        return res.status(429).json({ 
          error: `Limit reached! Each IP can only spit ${MAX_USES} times. You've used all your spit.` 
        });
      }

      const { image, mimeType } = req.body;

      if (!image || !mimeType) {
        return res.status(400).json({ error: "Missing image data. Please re-upload." });
      }

      if (!API_KEY) {
        return res.status(500).json({ error: "API Key is not configured on the server." });
      }
      const maskedKey = API_KEY.length > 8 
        ? `${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`
        : "INVALID_KEY_FORMAT";
      console.log(`Using API Key: ${maskedKey}`);

      // Step 1: Analyze image
      console.log("Analyzing image...");
      const visionResponse = await axios.post(CHAT_API_ENDPOINT, {
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
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 9000 // 9s timeout
      });

      const generatedPrompt = visionResponse.data.choices?.[0]?.message?.content || "A minimalist black and white cartoon caricature of a person in a spitting pose, bold lines, white background, text 'He~~tui' below.";
      console.log("Generated Prompt:", generatedPrompt);

      // Step 2: Generate image
      console.log("Generating image...");
      const imageResponse = await axios.post(IMAGE_API_ENDPOINT, {
        prompt: generatedPrompt + " Add the text 'He~~tui' at the bottom of the image.",
        size: "1K",
        google: {
          web_search: false,
          image_search: false
        },
        aspect_ratio: "1:1",
        output_format: "image/png"
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 9000 // 9s timeout
      });

      const imageData = imageResponse.data;
      let imageUrl = '';

      if (imageData.image_urls && imageData.image_urls.length > 0) {
        imageUrl = imageData.image_urls[0];
      } else if (imageData.url || imageData.image_url) {
        imageUrl = imageData.url || imageData.image_url;
      }

      if (!imageUrl) {
        throw new Error("No image URL returned from API");
      }

      // Increment limit on success
      ipLimits[ipStr] = currentUses + 1;

      res.json({ 
        imageUrl, 
        remaining: MAX_USES - ipLimits[ipStr] 
      });

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage = error.message;
      console.error("Server error detail:", {
        message: errorMessage,
        data: errorData,
        status: error.response?.status
      });
      
      let userMessage = "Failed to generate image. Please try again later.";
      if (errorMessage.includes("timeout")) {
        userMessage = "The request timed out. AI generation is taking too long, please try a smaller image or try again.";
      } else if (error.response?.status === 401) {
        userMessage = "Invalid API Key. Please check server configuration.";
      } else if (errorData?.error?.message) {
        userMessage = `API Error: ${errorData.error.message}`;
      }

      res.status(500).json({ 
        error: userMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

  // Only listen if not in a serverless environment
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();

export default async (req: any, res: any) => {
  try {
    const app = await appPromise;
    app(req, res);
  } catch (err) {
    console.error("Catastrophic server error:", err);
    res.status(500).send("Internal Server Error");
  }
};
