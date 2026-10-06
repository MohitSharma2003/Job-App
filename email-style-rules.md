# Email Style Rules — must read before every draft

Goal: emails must read as written by a human candidate (Mohit), and look
natural to any reader or spam/filters tooling.

## Always
- Write in Mohit's voice from `skills.md`. First person, warm but professional.
- Mohit has ALREADY graduated: B.E. Artificial Intelligence and Data Science,
  Class of 2026. Write "I recently completed my B.E. in Artificial Intelligence
  and Data Science (Class of 2026)". NEVER say "final year", "graduating in
  2026", or anything similar.
- Polite and confident. Thank the reader. Never beg: no self-deprecation, no
  "I would be grateful for any opportunity", no "please give me a chance".
- Vary structure: never use the same template twice. Change openings, sentence
  order, and word choice. NO closing word (no Regards, Thanks, Best regards):
  each email ends with its last sentence, then the signature block directly
  (name + links).
- Mention the real company name, the real role title, and 1–2 genuinely
  relevant details from the job posting (why THIS company, THIS role).
- Focus on what Mohit really knows: MERN (MongoDB, Express, React, Node.js),
  PostgreSQL, REST APIs, Docker, Git/GitHub.
- Lead, where relevant, with the NRSC/ISRO R&D internship (mention it generic:
  hands on experience working on full stack applications with the engineering
  team, NEVER describe the specific project built there) and FindOP as the
  LATEST project (opportunity intelligence platform, TypeScript, Node.js,
  MongoDB) plus a line that other projects were worked on too.
- Standard skill phrasing: "I have been building backend/full stack projects,
  and my most recent one is FindOP (TypeScript, Node.js, MongoDB). I have also
  worked on other projects along the way."
- Keep it 180 to 220 words. 4 to 6 short paragraphs. Plain text preferred.

## Never
- No AI-typical phrases: "As an AI", "I am reaching out", "leverage",
  "cutting-edge", "passionate", "I would love the opportunity to", generic
  praises, bullet-point walls in body.
- No identical bodies sent to multiple companies within a short window.
- No links that are not real URLs (portfolio, GitHub, LinkedIn are fine,
  always with https://).
- NEVER mention Flask anywhere. Mohit has not used Flask; we claim no skill
  that is not real (also: no claim of frameworks/stack beyond the MERN stack,
  PostgreSQL, REST APIs, Docker, Git, TypeScript, Python only where the posting
  asks for it, and Go only if genuinely relevant).
- NO dashes of any kind in the email: no em dash (—), en dash (–), or
  double hyphen. Rewrite using commas, periods, or "to" (e.g. "4 to 5.5 LPA",
  "10 September"). Dashes look AI-generated.
- NO "Attachment:", "Source:", "To:", "Subject:" lines inside the email body.
  Those are internal metadata in the draft file only and are NEVER sent.
- No asking to send anything other than the intended resume/portfolio link.

## Draft file format
Top of each draft file is an internal metadata block (never part of the email):
  RECIPIENT / SUBJECT
Do NOT list ATTACH or SOURCE lines inside drafts. The resume PDF
(D:\MohitJobApp\resume\Mohit_R_Sharma(Resume).pdf) is ALWAYS attached to every
application. Follow the metadata block with "[EMAIL BODY START]". The sent email
contains exactly three things: the subject, the body, and the attached resume
PDF. Nothing else.

## Signature (always the same, no education line)
End every email with this exact block:

Mohit Sharma
Phone: +91 7249496453
Email: mohit.sharma.dev2580@gmail.com
LinkedIn: https://linkedin.com/in/mohit-sharma-81a1ab256
GitHub: https://github.com/MohitSharma2003
Portfolio: https://mohitsharmaa.vercel.app

## Sending mechanics
- Send one email at a time, individually. Space sends 10 minutes apart
  minimum (NEVER burst 15+ emails within minutes; that triggers Google's
  "appears suspicious" flag and bounce-back, exactly like the Meteoros
  mail that got blocked).
- Daily cap for safe cold email from this personal Gmail: 15 sends per day
  maximum (hard Gmail limit is 500/day, but safe cold-email volume is
  15 to 25/day). At most 2 batches per day.
- Cooldown rules: if any message bounces or is flagged, STOP sending and wait
  48 hours with zero job-application sends, then resume at 15/day. After a long
  idle gap, restart low (never jump back to full volume). Never send on the
  same day right after a bounce/flag.
- Before sending: drafts must be approved by Mohit; send only after explicit
  approval of the batch.
- Do not send identical structure + same attachment across many sends in a
  short window; that pattern alone triggers the spam filter even under the
  cap. Always vary wording and structure (see style above).
- After sending: save the final message to `sent/` and append the row to
  `logs/application-log.md`.
- NEVER send to the same email address twice for the same job/role. Before any
  send, check the log (company + recipient) and `sent/`; if that company/role
  was already applied to at that address, do not send again. If a company has
  multiple identical postings for the same role, send only once (one recipient
  per role). Re-application only if the user explicitly asks for a follow-up.