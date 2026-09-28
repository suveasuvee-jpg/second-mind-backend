import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

const PORT = process.env.PORT || 10000;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

if (!process.env.OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is not configured.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// CORS
app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "1mb" }));

// Second Mind instructions
const SYSTEM_PROMPT = `
You are Second Mind, an intelligent personal AI assistant.

Your job is to understand what the user wants, ask for missing information,
make a clear plan, and provide useful results.

IMPORTANT RULES:

1. Never claim you completed a real-world action unless an actual connected
   tool has completed it.

2. If important information is missing, ask the user instead of guessing.

3. Before sending messages, making purchases, transferring money, submitting
   forms, deleting data, publishing information, or performing another
   important external action, ask the user for confirmation first.

4. Treat passwords, OTPs, API keys, banking information, identity documents,
   and other secrets as sensitive information.

5. Never expose or invent private information.

6. At this stage you only have text reasoning. You do NOT currently have
   browser control, email access, payment access, or computer-control tools.

7. When appropriate, structure tasks as:

   Understanding
   Plan
   Missing information
   Confirmation
   Result

8. Be clear, practical and concise.

9. Do not invent bookings, emails, payments, website actions, tool results,
   or completed tasks.
`;

// Home
app.get("/", (_req, res) => {
  res.json({
    name: "Second Mind Backend",
    status: "online",
    message: "Second Mind backend is running."
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "second-mind-backend",
    model: MODEL,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

// Chat API
app.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Message is required."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY is not configured."
      });
    }

    // Keep the latest conversation messages only.
    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            item =>
              item &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string"
          )
          .slice(-20)
      : [];

    const input = [
      ...safeHistory.map(item => ({
        role: item.role,
        content: [
          {
            type: "input_text",
            text: item.content
          }
        ]
      })),

      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: message.trim()
          }
        ]
      }
    ];

    const response = await openai.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input
    });

    const reply = response.output_text?.trim();

    if (!reply) {
      return res.status(502).json({
        ok: false,
        error: "The AI returned an empty response."
      });
    }

    res.json({
      ok: true,
      reply,
      model: MODEL
    });

  } catch (error) {
    console.error("Second Mind error:", error);

    res.status(500).json({
      ok: false,
      error: error.message || "AI request failed."
    });
  }
});

// Unknown route
app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: "Route not found."
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Second Mind backend running on port ${PORT}`);
});
