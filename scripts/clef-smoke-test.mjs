// One-off Clef connectivity check (no secrets or raw API responses in logs).
// Run: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/clef-smoke-test.mjs
import fs from "node:fs";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
if (!accountId || !token) {
  console.error("FAIL: CLOUDFLARE_ACCOUNT_ID and/or CLOUDFLARE_API_TOKEN secret is unavailable.");
  process.exit(1);
}
if (!/^[a-zA-Z0-9_-]+$/.test(accountId)) {
  console.error("FAIL: Account ID format is invalid.");
  process.exit(1);
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef`;
const payload = {
  model: "clef",
  state: {
    task: "Select a browser game prototype for repeated, meaningful play, not just an attractive pitch.",
    candidate_a: "Move a character around a small maze. Enemies patrol, keys unlock routes, and a limited-use decoy lets players choose risk versus reward. Routes and threats change between attempts.",
    candidate_b: "Press one button and watch a random beautiful sky animation. There are no choices or interactions after the button press.",
  },
  questions: {
    best_prototype: {
      type: "choice",
      instructions: "Which candidate offers the stronger foundation for ten minutes of actively engaging, replayable gameplay?",
      criteria: {
        a: "Candidate A: maze exploration, moving threats, and repeated decisions",
        b: "Candidate B: a single tap followed by a visual animation",
      },
    },
    a_has_decisions: {
      type: "noul",
      instructions: "Does candidate A ask the player to make meaningful decisions during play?",
    },
    a_gameplay_depth: {
      type: "score",
      instructions: "How much gameplay depth does candidate A have, based only on the supplied description?",
      criteria: [
        "No meaningful interaction",
        "One repeated trivial action",
        "Some choices with little consequence",
        "Several consequential choices",
        "Rich and varied meaningful choices",
      ],
    },
  },
};

function failure(reason) {
  // Do not print the HTTP URL, headers, raw JSON errors, account ID, or token.
  console.error(`FAIL: ${reason}`);
  process.exitCode = 1;
}
try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    let errorCode = "unknown";
    try {
      const parsed = await response.json();
      const n = parsed?.errors?.[0]?.code;
      if (typeof n === "number" || (typeof n === "string" && /^\\d{1,6}$/.test(n))) errorCode = String(n);
    } catch { /* Ignore malformed error body; never log it. */ }
    failure(`Cloudflare returned HTTP ${response.status} (error code ${errorCode}).`);
  } else {
    const body = await response.json();
    if (body?.success === false) {
      failure("Cloudflare returned success=false.");
    } else {
      const result = body?.result ?? body;
      const decision = result?.answers?.best_prototype;
      const yesNo = result?.answers?.a_has_decisions;
      const depth = result?.answers?.a_gameplay_depth;
      const validChoice = decision?.type === "choice" &&
        ["a", "b"].includes(decision.choice) &&
        ["a", "b"].every(k => Number.isFinite(decision.probabilities?.[k]));
      const validNoul = yesNo?.type === "noul" &&
        Number.isFinite(yesNo.noul) && yesNo.noul >= 0 && yesNo.noul <= 1;
      const validScore = depth?.type === "score" &&
        Number.isFinite(depth.score) && depth.score >= 0 && depth.score <= 4;
      if (!validChoice || !validNoul || !validScore) {
        failure("Clef returned a response, but the expected decision schema did not match.");
      } else {
        const rows = [
          "## Clef API connectivity — PASS",
          "",
          "| Decision | Result |",
          "| --- | --- |",
          `| Preferred prototype | ${decision.choice.toUpperCase()} |`,
          `| Choice A probability | ${decision.probabilities.a.toFixed(3)} |`,
          `| Choice B probability | ${decision.probabilities.b.toFixed(3)} |`,
          `| A has meaningful decisions (yes probability) | ${yesNo.noul.toFixed(3)} |`,
          `| A depth score (0–4) | ${depth.score.toFixed(2)} |`,
          "",
          "Connectivity success does not establish game-judgment accuracy.",
        ];
        const summary = rows.join("\n") + "\n";
        if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
        console.log(summary);
      }
    }
  }
} catch (error) {
  failure(error?.name === "TimeoutError" ? "Cloudflare request timed out." : "Cloudflare request failed before a valid response.");
}
