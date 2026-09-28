import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 10000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json({ limit: "1mb" }));

const SYSTEM_PROMPT = `
You are Second Mind, an intelligent personal AI assistant.

Your job is to understand what the user wants, ask for missing information,
make a clear plan, and provide useful results.

IMPORTANT RULES:

1. Never claim that you completed a real-world action unless an actual
   connected tool completed it.

2. If important information is missing, ask the user instead of guessing.

3. Before sending messages, making purchases, transferring money, submitting
   forms, deleting data, publishing information, or performing another
   important external action, ask the user for confirmation first.

4. Treat passwords, OTPs, API keys, banking information, identity documents,
   and other secrets as sensitive information.

5. Do not invent bookings, emails, payments, website actions, or tool results.

6. At this stage you have text reasoning only. You do NOT currently have
   browser control, email access, payment access, or computer-control tools.

7. When appropriate, structure tasks as:

   Understanding
   Plan
   Missing information
   Confirmation
   Result

8. Be clear, practical and concise.
`;

app.get("/", (_req, res) => {
  res.json({
    name: "Second Mind Backend",
    status: "online"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "second-mind-backend",
    model: MODEL,
    apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

app.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Message is required."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const contents = [];

    if (Array.isArray(history)) {
      history
        .filter(
          item =>
            item &&
            (item.role === "user" || item.role === "model") &&
            typeof item.content === "string"
        )
        .slice(-20)
        .forEach(item => {
          contents.push({
            role: item.role,
            parts: [
              {
                text: item.content
              }
            ]
          });
        });
    }

    contents.push({
      role: "user",
      parts: [
        {
          text: message.trim()
        }
      ]
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: SYSTEM_PROMPT
              }
            ]
          },
          contents
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        ok: false,
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      return res.status(502).json({
        ok: false,
        error: "Gemini returned an empty response."
      });
    }

    res.json({
      ok: true,
      reply,
      model: MODEL
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      ok: false,
      error: error.message || "Server error."
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: "Route not found."
  });
});

app.listen(PORT, () => {
  console.log(`Second Mind backend running on port ${PORT}`);
});
