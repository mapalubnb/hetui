import express from "express";
import { createServer as createViteServer } from "vite";
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
const MAX_USES = 4;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API route for generation
  app.post("/api/generate", async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ipStr = Array.isArray(ip) ? ip[0] : ip || 'unknown';

    // Check limit
    const currentUses = ipLimits[ipStr] || 0;
    if (currentUses >= MAX_USES) {
      return res.status(429).json({ 
        error: `Limit reached! Each IP can only spit 4 times. You've used all your spit.` 
      });
    }

    const { image, mimeType } = req.body;

    if (!image || !mimeType) {
      return res.status(400).json({ error: "Missing image data" });
    }

    try {
      // Step 1: Analyze image
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
        }
      });

      const generatedPrompt = visionResponse.data.choices?.[0]?.message?.content || "A minimalist black and white cartoon caricature of a person in a spitting pose, bold lines, white background, text 'He~~tui' below.";

      // Step 2: Generate image
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
        }
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
      console.error("Server error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to generate image. Please try again later." });
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
