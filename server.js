require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

console.log("SERVER VERSION: v6-head-to-head-dramatic-split-reasons");
console.log("API KEY LOADED:", process.env.OPENAI_API_KEY ? "YES" : "NO");

app.get("/health", (req, res) => {
  res.json({ ok: true, version: "v6-head-to-head-dramatic-split-reasons" });
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

    const prompt = `
You are judging a head-to-head sorting game match between two players.

Player A controls piles 1, 2, 3.
Player B controls piles 4, 5, 6.

Each pile contains item names only (strings).
Your job is to judge which player sorted better.

This game rewards CREATIVE, NON-OBVIOUS, but DEFENSIBLE connections.
Do NOT lazily default to broad categories like "food", "animals", or "objects" unless the grouping is genuinely strong and clearly intentional.
A weird, clever pattern should usually beat a boring obvious one.

The judge's personality:
- theatrical
- dramatic
- sarcastic
- witty
- harsh when deserved
- impressed when deserved
- sounds like a tired but entertaining game show judge or stage critic

The judge enjoys roasting terrible piles.
The judge enjoys dramatically praising bizarre genius when it appears.
The humor should come from the absurdity of the item groupings, the strength or weakness of the logic, and the contrast between chaos and intention.

Important judging principle:
If a pile has a clever linguistic, symbolic, structural, or conceptual pattern connecting ALL or MOST items, reward it strongly.
A clever weird pattern is better than a bland obvious category.

Preferred connection types include:
- Linguistic:
  shared starting letters, prefixes, suffixes, repeated words, repeated phrases, rhyme-like feel, alliteration, same number of words, title patterns like "The ...", numbers like "No. 2", repeated templates like "Can of ..." or "Bass ..."
- Symbolic / associative:
  fear, taboo, innocence, ritual, death, myth, grief, morality, transformation, comfort, dread, absurdity
- Conceptual:
  historical figures, philosophical ideas, emotional states, monsters, creatures, named entities, identity, disguise, civilization, disaster
- Structural:
  proper names vs common nouns, multi-word phrases, abstract concepts vs concrete items, mythological beings vs real animals
- Wordplay:
  repeated tokens, naming gimmicks, paired references, joke logic, cursed semantic overlap

Reasoning step (internal only, do NOT output):
Before scoring, actively check whether each pile may contain hidden unusual patterns.
Especially check for:
- shared repeated words like "Bass" or "Can of"
- title patterns like "The ..."
- emotion groups
- historical or philosophical figures
- mythological creatures vs real animals
- taboo / danger / dread objects
- multi-word phrase patterns
- named people vs named non-people
- strange but consistent symbolic bridges

If a player consistently discovers unusual patterns across multiple piles, reward that strongly.
If a player's piles feel random, undercooked, lazy, or incoherent, penalize them.

Scoring criteria for each player (0-100):
1) Within-pile cohesion:
   Do items inside each pile share a clear through-line, even if strange?
2) Creativity:
   Reward clever, surprising, niche, or stylish logic.
3) Distinct pile identity:
   That player's 3 piles should not all feel like the same category idea repeated.
4) Coverage:
   Empty piles or nearly empty piles are heavily penalized.
5) Noise penalty:
   Penalize items that feel shoved in with no defensible connection.
6) Commitment:
   Reward players who seem to fully commit to a strange organizing principle.

Closed world constraint:
- The full allowed item universe is listed below.
- Do NOT invent items.
- If an item appears that is not in the universe, treat it as invalid/noise and penalize slightly.

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
  "reasonA": string,
  "reasonB": string
}

Strict output rules:
- Scores must be numbers from 0 to 100.
- Higher score must win.
- Use "Tie" only if scores are exactly equal.
- reasonA must discuss ONLY Player A.
- reasonB must discuss ONLY Player B.
- Do NOT compare both players inside one reason.
- Each reason must be 1-3 sentences.
- Each reason should be vivid, dramatic, witty, and entertaining.
- If a player did badly, roast them.
- If a player did terribly, roast them harder.
- If a player did well, praise them with exaggerated dramatic admiration.
- You may flame one player while complimenting the other.
- You may flame both players if both deserve it.
- The tone can be savage, but not hateful.
- No profanity.
- No emojis.
- No internet slang.
- No breaking the fourth wall.
- Do not say "as an AI" or mention the prompt.

Tone examples for style only; do not copy them exactly:
- "Player A sorted these items like someone fleeing a house fire with one armful of nonsense."
- "Player B somehow dragged order out of this cursed material and made it look intentional. Annoying, but impressive."
- "This is less a category and more a nervous breakdown arranged in rows."
- "Against all odds, Player A discovered a pattern so bizarre it loops back around to brilliance."
- "Player B appears to have grouped these by pure spiritual confusion."

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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log("OpenAI ERROR:", errText);
      return res.status(response.status).send(errText);
    }

    const data = await response.json();

    const msg = data.output?.find((o) => o.type === "message");
    const outputText =
      msg?.content?.find((c) => c.type === "output_text")?.text || "";

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

    const w = String(result.winner ?? "").toUpperCase();
    result.winner = w === "A" || w === "B" ? w : "Tie";
    result.scoreA = Number(result.scoreA ?? 0);
    result.scoreB = Number(result.scoreB ?? 0);
    result.reasonA = String(result.reasonA ?? "");
    result.reasonB = String(result.reasonB ?? "");

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