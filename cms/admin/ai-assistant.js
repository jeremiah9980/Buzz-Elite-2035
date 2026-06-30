(function () {
  const templates = {
    announcement: ({ facts, tone }) =>
`Bombers Update

${facts || "Add the key update here."}

The Bombers continue to build with purpose, stay team-first, and compete the right way. More details will be shared as they are confirmed.

#BombersFastpitch #BlueBloods #TeamFirst`,

    gameRecap: ({ facts, tone }) =>
`Game Recap

${facts || "Add opponent, score, key moments, and player/team highlights."}

The Bombers showed toughness, energy, and a next-pitch mindset. Proud of the work, proud of the effort, and ready for the next one.`,

    socialCaption: ({ facts, tone }) =>
`Built Different. Play Fast. Finish Strong.

${facts || "Add the moment, event, or player/team highlight."}

Proud of this group and the work they keep putting in. #BombersFastpitch #CTXBombersMeza #BlueBloods`,

    playerBio: ({ facts, tone }) =>
`Player Profile Draft

${facts || "Add jersey number, positions, strengths, work ethic, and approved family/coach notes."}

She brings energy, coachability, and a team-first approach every time she steps on the field. Her profile should stay positive, age-appropriate, and only use details approved by her parent or guardian.`,

    sponsorThanks: ({ facts, tone }) =>
`Sponsor Thank You

Thank you to ${facts || "our sponsor"} for supporting CTX Bombers Meza.

Your support helps our athletes with tournament costs, team needs, equipment, and the opportunity to compete and grow together. We appreciate you investing in these players and families.`,

    tournamentPreview: ({ facts, tone }) =>
`Tournament Preview

${facts || "Add tournament name, date, location, division, first game time, and team goals."}

The Bombers are ready to compete with energy, discipline, and a team-first mindset. Follow the NCS dashboard and team updates for scores and weekend progress.`
  };

  function applyTone(text, tone) {
    if (tone === "short") return text.split("\n").filter(Boolean).slice(0, 4).join("\n\n");
    if (tone === "hype") return text + "\n\nLet’s go Bombers!";
    if (tone === "professional") return text.replace(/Let’s go Bombers!/g, "").replace(/Built Different\./g, "Prepared.").trim();
    if (tone === "family-friendly") return text + "\n\nThank you to our families, coaches, and supporters.";
    return text;
  }

  async function hostedDraft({ endpoint, type, facts, tone, context }) {
    if (!endpoint) return null;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, facts, tone, context })
    });
    if (!response.ok) throw new Error(`AI endpoint failed: ${response.status}`);
    const data = await response.json();
    return data.text || data.output || "";
  }

  window.BombersAI = {
    draft: async ({ type, facts, tone, endpoint, context }) => {
      const fromEndpoint = await hostedDraft({ endpoint, type, facts, tone, context }).catch((error) => {
        console.warn(error);
        return null;
      });
      if (fromEndpoint) return fromEndpoint;
      const fn = templates[type] || templates.announcement;
      return applyTone(fn({ facts, tone, context }), tone);
    },

    polish: ({ text, tone }) => {
      const cleaned = String(text || "")
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (!cleaned) return "Add content first, then use Polish Current Section.";
      return applyTone(cleaned, tone);
    }
  };
})();
