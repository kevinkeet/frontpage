# Product

## Register

brand

## Users

Primary: academic and medical-education peers (program directors, conference contacts, grant reviewers, collaborators in AI + medical education) who look Kevin up after a talk, paper, or introduction. They are simultaneously vetting credibility (is this person serious?) and personality (would I want to work with them?).

Secondary: recruiters and leadership evaluating Kevin for roles or funding; patients or families who met him in the hospital and are curious. Patients must encounter warmth and zero medical-advice risk (the Frankenstein chatbot has an explicit guardrail for this).

Context: most arrive via a link on a phone or laptop, spend 30 to 120 seconds, and leave with an impression. A minority explore the interactive scene and chat with the dog.

## Product Purpose

An interactive "visual resume" at kevinkeet.com. A lo-fi illustrated scene of Kevin's study (animated video background) where objects are hover/tap hotspots revealing credentials, projects, and personal life, plus an AI chatbot (Frankenstein, his Bloodhound) that answers questions about him, and links out to his built apps. Success: a visitor leaves thinking "credible, original, warm; I want to talk to this person," and can find his work and contact info in seconds.

## Brand Personality

Warm, playful, credible. Serious academic work (Stanford hospitalist, $200K RCT PI, BMJ editorial) presented with humor and humanity (lo-fi beats, a chatty bloodhound, surfboards). Bedside empathy is a core theme: the site should feel like the person who pulls up a chair.

## Anti-references

- Generic tech-bro portfolio: dark-mode-by-default flexing, gradient text, "I build things," GitHub-stats energy. Overdone in AI circles.
- Cutesy/unserious: so playful that a grants committee or dean would discount him. The whimsy must sit on top of visible substance.

## Design Principles

1. The scene is the resume. The illustrated room carries the identity; UI chrome should frame it, never compete with it.
2. Whimsy with receipts. Every playful element (dog, music, hotspots) sits within reach of hard credentials; never one without the other.
3. Two-minute visitor first. Tagline, project links, and contact must land without interaction; the interactive layer is a reward, not a requirement.
4. Warmth is the differentiator. Where a choice exists between slick and human, choose human; this is a doctor who sits with patients, not a startup landing page.
5. Works in the hallway. Conference wifi, phone screens, one thumb: every credential reachable without hover.

## Accessibility & Inclusion

- Hotspots must remain keyboard-focusable with visible focus states and aria-labels (implemented 2026-06).
- Mobile gets a full content fallback (detail cards) since hover is unavailable (implemented 2026-06).
- Autoplaying background video is muted and decorative; consider prefers-reduced-motion handling.
- Chatbot must never give medical advice; patient-facing guardrail lives in the system context.
- Target WCAG AA contrast for text over the dark slate UI.
