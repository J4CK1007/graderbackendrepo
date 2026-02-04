require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

console.log("SERVER VERSION: v4-head-to-head-A123-vs-B456");
console.log("API KEY LOADED:", process.env.OPENAI_API_KEY ? "YES" : "NO");

app.get("/health", (req, res) => {
  res.json({ ok: true, version: "v4-head-to-head-A123-vs-B456" });
});

// Helper: normalize request piles into a predictable shape:
// Accepts either:
// piles: [ { pileId: "1", items: ["a","b"] }, ... ]
// or piles: { "1": ["a","b"], "2": ["c"] ... }
function normalizePiles(piles) {
  if (Array.isArray(piles)) {
    return piles.map((p) => ({
      pileId: String(p.pileId ?? ""),
      items: Array.isArray(p.items) ? p.items.map(String) : [],
    }));
  }

  if (piles && typeof piles === "object") {
    return Object.keys(piles).map((k) => ({
      pileId: String(k),
      items: Array.isArray(piles[k]) ? piles[k].map(String) : [],
    }));
  }

  return null;
}

app.post("/grade", async (req, res) => {
  try {
    // Optional: see what Unity sent
    console.log("=== /grade received body ===");
    console.log(JSON.stringify(req.body, null, 2));

    const pilesRaw = req.body?.piles;
    if (!pilesRaw) {
      return res.status(400).json({ error: "Missing 'piles' in request body" });
    }

    const piles = normalizePiles(pilesRaw);
    if (!piles) {
      return res.status(400).json({ error: "Invalid 'piles' format" });
    }

    // Ensure we always judge exactly 6 piles (1..6). Fill missing with empty.
    const byId = new Map(piles.map((p) => [String(p.pileId), p.items]));
    const sixPiles = ["1", "2", "3", "4", "5", "6"].map((id) => ({
      pileId: id,
      items: byId.get(id) ?? [],
    }));

    // Closed-world item universe (prevents invention + enables meta-pattern scoring)
    const ITEM_UNIVERSE = [
      "Apple",
      "Banana",
      "Carrot",
      "Tomato",
      "Celery",
      "Brocoli",
      "Can of Sardines",
      "Bass Fish",
      "Bass Guitar",
      "Bass Pro Shop Pyramid",
      "Samsara",
      "The I Ching",
      "Cocytus",
      "Nuclear Bomb",
      "Eraserhead Baby",
      "No. 2 Pencil",
      "Dog",
      "Cat",
      "Mouse",
      "Horse",
      "Parakeet",
      "Hyrax",
      "Hydra",
      "Tsuchinoko",
      "Gnome",
      "Chimera",
      "Sphinx",
      "Centaur",
      "Zombie",
      "Jimmy Carter",
      "Gerald Ford",
      "Lyndon B. Johnson",
      "Dwight D. Eisenhower",
      "Harry S. Truman",
      "Abraham Lincoln",
      "Denial",
      "Anger",
      "Bargaining",
      "Depression",
      "Acceptance",
      "Skeleton",
      "Pinocchio",
      "Diogenes",
      "Socrates",
      "Wizard Hat",
      "Chubby Bunny Challenge",
      "Aztec Death Whistle",
      "Ball of Clay",
      "Dracula",
      "Frankenstein’s Monster",
      "Can of Beer",
      "Heroin",
      "Cocaine",
      "Can of Soup",
    ];

    // Head-to-head prompt (Player A = 1-3, Player B = 4-6)
    const prompt = `
You are judging a sorting game match between two players.

Player A controls piles 1, 2, 3.
Player B controls piles 4, 5, 6.

Each pile contains item names only (strings).
Judge which player sorted better.

IMPORTANT: This game rewards CREATIVE, non-obvious but defensible connections.
Do NOT default to generic categories like "food/animals/objects" unless the player clearly intended it and it creates strong cohesion.

Prefer connections that are:
- Linguistic: same starting letter, shared prefixes/suffixes, word count, initials, punctuation patterns, "The ..." patterns, numbers ("No. 2"), repeated words (e.g., "Can of ...", "Bass ...").
- Symbolic/associative: cultural symbolism, metaphor, narrative role (monster/hero/tool), emotional resonance.
- Conceptual bridges: e.g., "Abraham Lincoln" can connect to "Acceptance" (reconciliation/emancipation/forgiveness themes) if used consistently.
- Form/structure: multi-word names, proper names vs common nouns, myth-name vibe, “named entity” patterns.
- Morality/comfort: items that evoke moral discomfort, taboo, fear, dread, innocence, ritual, etc.

Scoring criteria (0–100 each):
1) Within-pile cohesion: items share multiple plausible links (even if weird). Strong piles have a clear "through-line".
2) Novelty: niche/clever connections score higher than obvious taxonomy.
3) Distinct piles: each player's three piles should feel meaningfully different (different connection logic).
4) Coverage: empty piles are heavily penalized.
5) Noise penalty: mixing items with no defensible connection is bad.

Closed world constraint:
- The full allowed item universe is listed below.
- Do NOT invent items. If you see an item not in the universe, treat it as invalid/noise and penalize slightly.

Allowed item universe:
${JSON.stringify(ITEM_UNIVERSE, null, 2)}

Return ONLY valid JSON.
Do NOT use markdown.
Do NOT use backticks.
Do NOT add explanations outside JSON.

Return JSON in EXACTLY this schema:
{
  "winner": "A" | "B" | "Tie",
  "scoreA": number,
  "scoreB": number,
  "reason": string
}

Rules:
- Scores must be 0–100.
- Higher score must win.
- Use "Tie" if scores are the same.
- Reason must be short (1–3 sentences).
- The reason should be lightly humorous or dryly witty, like a judge who is tired but amused.
- Humor should come from pointing out odd or clever connections, mild sarcasm, or playful disbelief.
- Do NOT use jokes that break immersion, emojis, or internet slang.
- Example tone (do not copy): "Player A bravely grouped nuclear annihilation with canned soup. Bold choice, questionable logic."


Piles:
${JSON.stringify(sixPiles, null, 2)}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log("OpenAI ERROR:", errText);
      return res.status(response.status).send(errText);
    }

    const data = await response.json();

    // Extract assistant text from Responses API
    const msg = data.output?.find((o) => o.type === "message");
    const outputText =
      msg?.content?.find((c) => c.type === "output_text")?.text || "";

    // Clean accidental fences
    const cleanedText = outputText
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch (e) {
      console.log("JSON PARSE FAILED. RAW OUTPUT:\n", outputText);
      return res
        .status(500)
        .json({ error: "Model did not return valid JSON", raw: outputText });
    }

    // Safety normalization for winner schema
    const w = String(result.winner ?? "").toUpperCase();
    result.winner = w === "A" || w === "B" ? w : "Tie";
    result.scoreA = Number(result.scoreA ?? 0);
    result.scoreB = Number(result.scoreB ?? 0);
    result.reason = String(result.reason ?? "");

    return res.json(result);
  } catch (err) {
    console.log("SERVER ERROR:", err);
    res.status(500).json({ error: err.toString() });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on http://localhost:" + port);
});
