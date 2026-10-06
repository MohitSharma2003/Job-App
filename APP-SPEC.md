# AI Job Application System — Full Specification

A complete, implementation-ready description of the system built in this
conversation. Any developer or AI agent with this document should be able to
rebuild an equivalent application from scratch without access to the original
chat history.

This document supersedes and merges two earlier documents:
`SYSTEM.md` (the manual working setup) and `job-email-applier-project-spec.md`
(the productisation draft). Where they conflict, this document wins.

---

## 1. What this system does

It finds job openings that fit one specific candidate, verifies a real
contactable email address for each one, writes a unique human-sounding
application email for each opening, sends that email with the candidate's
resume attached from the candidate's own Gmail account, and records everything
so nothing is ever sent twice.

The distinguishing feature versus typical mail-merge tools is the middle of the
pipeline: **discovery and email verification are first-class features, not
manual data entry.** The system refuses to send to any address it has not
independently confirmed from a real source.

### 1.1 The seven-stage pipeline

```
  [1] DISCOVER      search X/Twitter, LinkedIn, aggregators for openings
        |
  [2] VERIFY        confirm the opening is live + find a real email address
        |          (reject dead, closed, portal-only, unverified)
  [3] MATCH         score the opening against the candidate profile
        |          (skills, role type, allowed locations)
  [4] DEDUPE        check the log; reject already-sent company+email pairs
        |
  [5] DRAFT         write one unique email per opening (180-220 words)
        |
  [6] APPROVE       explicit human review and approval, per draft
        |
  [7] SEND          rate-limited send via Gmail API with resume attached
        |
  [8] TRACK         archive a copy, append a log row, monitor for bounces
```

Stages 1 to 4 produce a **qualified lead queue**. Stages 5 to 8 are the
**sending pipeline**. The two halves have different risk profiles and can be
built and operated independently.

---

## 2. Persona and profile

One candidate. The system is built around a real profile but must be
generalised to any single user with one resume and one connected mailbox.

**Candidate profile (the concrete instance this was built for):**

| Field | Value |
|---|---|
| Name | Mohit Sharma |
| Education | B.E. Artificial Intelligence and Data Science, Class of 2026 |
| Internship | R&D intern, NRSC / ISRO, Hyderabad |
| Project | FindOP, an opportunity intelligence platform |
| Core stack | React, Node.js, Express, MongoDB, TypeScript, PostgreSQL, REST APIs, Docker, Git/GitHub |
| Secondary | Python, Go, machine learning, data engineering |
| Base location | Nashik, Maharashtra |
| Willing to relocate | Bengaluru, Hyderabad, Pune, Mumbai, Chennai, Delhi NCR |
| Remote | Yes, Remote India |
| Resume | One PDF, attached to every email |
| Mailbox | Personal Gmail, connected via OAuth |

**Hard match rules:**

- Role types: internships, entry-level full time, 0 to 2 years experience.
- Location: only the allowed city list, or Remote India. A lead outside the
  list is rejected even if the role is a perfect technical match. Known
  rejections: Kochi, Coimbatore, Tirunelveli, Vadodara, Jaipur, Indore.
- Stack: the candidate may only claim skills the resume supports. Python is
  mentioned only when the posting asks for it. Go only when the posting asks.
  Flask is never mentioned.
- Degree mismatch (for example a mandatory MSc) disqualifies the lead
  regardless of match quality.

---

## 3. Stage 1, Discovery

### 3.1 Sources

| Source | Method | Notes |
|---|---|---|
| X / Twitter | Search engine query `site:x.com` plus a hiring keyword, then fetch the post | Highest yield for remote and fresher roles. Posts frequently have no apply link and no email, so the post alone is never sufficient. |
| LinkedIn | Fetch public job search URLs by keyword and location | Job cards are usually visible in page text but job URLs are often absent from the text dump. Individual job pages must be located separately. |
| Job aggregators | freshershunt.in, myinternships.in, campustocareer.info, xcareers.in | Useful for volume, low verification quality. Many leads are stale or aggregator-scraped. |
| Company career pages | Direct fetch of the careers/contact URL discovered via a lead | Highest verification quality, used as the final confirmation step. |

### 3.2 Discovery queries that worked

```
site:x.com hiring fresher developer MERN India job opening 2026
site:x.com #hiring full stack developer fresher India email resumes
site:x.com "drop your resume" OR "mail your resume" fresher developer India
site:x.com/hiring/#hiring fresher software engineer India remote apply email
```

Useful X accounts that post fresher developer rounds: `@SCR01111`,
`@Ayushi_sharma02`, `@softwareduniyas`, `@fjafreshers`, `@vistechindia`.

### 3.3 Output of discovery

A raw lead list. At this stage an email address is usually unknown, and the
"opening" is often a third-party roundup rather than the employer's own
posting. Everything must be treated as an unverified claim.

---

## 4. Stage 2, Verification

This is the highest-value stage and the one most tools get wrong. A lead is
only promoted to "sendable" if **all** of the following hold.

### 4.1 Rules

1. **The email must be found literally in real page text.** Never construct,
   never guess, never pattern-match a company name into a domain. If a
   directory says `hr@` and the company domain is unknown, it is not
   confirmed.
2. **The source URL must be recorded** for every address. A lead without a
   source URL is not sendable.
3. **Prefer purpose-built inboxes** in this order: `careers@`, `jobs@`,
   `talent@`, `recruiting@`, `hr@`, `hrteam@`, then general `info@`, `hello@`,
   `contact@`, `connect@`, `admin@`, `support@`, `sales@`.
4. **Reject the lead entirely if the role is dead.** A closed, expired, or
   reposted-with-old-date posting is a rejection, not a fallback.
5. **Reject if the company cannot be confirmed to exist.** Several recruiter
   posts advertise companies with no website and no corporate footprint. These
   are discarded outright.
6. **Portal-only means reject**, not "find a guess". Naukri, Wellfound,
   Greenhouse, Lever, Ashby, Oracle ATS and similar are application forms
   without a public recruiting inbox. These are recorded as
   `EMAIL_NOT_FOUND` and skipped.
7. **In-app-only platforms are reject.** A company that accepts applications
   only through its own authenticated product (for example Zoho's candidate
   portal, Outlier's app, Appen's CrowdGen) should not receive a cold email,
   even if a support address is published.
8. **Support, sales, press, privacy, DPO and POSH addresses are not HR.** If
   the only published address is `privacy@` or `dpo@`, the lead is rejected.
   This is a real failure mode, for example Teciem publishes only
   `data.privacy@` and `POSH.India@`.
9. **Every rejection reason is recorded**, not just the rejection. The reasons
   are the audit trail that stops the same dead lead being re-investigated.

### 4.2 Verification outcomes

Each lead resolves to exactly one of:

| Outcome | Meaning | Sendable |
|---|---|---|
| `FOUND_ON_COMPANY_SITE` | Address found in text on the company's own page | Yes |
| `EMAIL_NOT_FOUND` | No recruiting address published | No |
| `ROLE_CLOSED` | Posting is dead | No |
| `COMPANY_UNVERIFIABLE` | No corporate presence found | No |
| `PORTAL_ONLY` | Form-based application system | No |
| `IN_APP_ONLY` | Application requires product signup | No |
| `NON_HR_ADDRESS` | Only support/press/privacy contacts published | No |
| `OUT_OF_SCOPE_LOCATION` | City not on the allowed list | No |
| `STACK_MISMATCH` | Mandatory stack the candidate does not have | No |

### 4.3 Worked examples from the real pipeline

| Lead | Outcome | Reason |
|---|---|---|
| ArchWyse, MERN + GenAI intern | `ROLE_CLOSED` | Site live, address `support@archwyse.com` is not HR, role closed |
| Willder, frontend WFH | `COMPANY_UNVERIFIABLE` | Advertised by a recruiter, no such company exists |
| Teciem, associate SWE, Bengaluru | `EMAIL_NOT_FOUND` | Real site, real ATS, only DPO and POSH addresses published |
| Zoho, fresher web developer | `IN_APP_ONLY` | No HR address anywhere, candidate portal only |
| Outlier.ai, remote coding | `IN_APP_ONLY` | Only `privacy@outlier.ai` published, applications are in-app |
| VistechIndia, Hyderabad frontend | `COMPANY_UNVERIFIABLE` | Account is a repost aggregator, not a hiring employer |
| AstroLabs, Chennai dev platform | `STACK_MISMATCH` | Actually a Dubai business-setup firm, not an Indian dev-tools company |
| Sufura Innovations | `COMPANY_UNVERIFIABLE` | No matching company, likely a misremembered name |
| 42Gears, SWE L1, Bengaluru | `FOUND_ON_COMPANY_SITE` | `jobs@42gears.com`, careers page explicitly invites resume drops |
| SymphonyAI, apprentice SWE | `FOUND_ON_COMPANY_SITE` | `recruiting@symphonyai.com` on the careers page |
| Finzo AI, full stack intern | `FOUND_ON_COMPANY_SITE` | `careers@finzo.ai` on the careers page, but the intern role was not currently listed |

---

## 5. Stage 3, Matching

Score each verified lead against the profile.

| Signal | Weight | Notes |
|---|---|---|
| Role type (intern / 0-2 yr) | required | Hard filter, not a score |
| Location on allowed list | required | Hard filter |
| Stack overlap with resume | high | MERN and TypeScript weighted highest |
| Company product relevance | medium | AI or fintech or dev-tools products score higher |
| Contact inbox quality | medium | Purpose-built HR beats general inbox |
| Compensation | low | Informational only, never overrides a hard filter |
| Recency of posting | medium | Anything older than roughly 30 days is treated as stale |

A lead that fails a hard filter is never drafted. A lead that passes hard
filters but scores low overall is held for the user to decide rather than
auto-sent.

---

## 6. Stage 4, Deduplication

Deduplication is enforced by a log, not by memory.

- Dedupe key: **normalised company name plus recipient email address**.
  Normalise by lowercasing and stripping punctuation, legal suffixes, and
  domain aliases (`mail@` and `hr@` on the same domain are different keys;
  `hr.x@y.com` and `hr.x@y.co` are the same company).
- A company that has already been emailed may receive **at most one** further
  contact only when the user explicitly requests it, for example a second
  recruiter address at the same company for a genuinely different role.
- A resend is permitted **only** after the user confirms the original bounced
  or was rejected. The resend is logged as a distinct row, never as an
  overwrite.
- Before drafting any lead, the pipeline must read the log. Drafting a lead
  that already exists in the log is a bug, not a user error.

### 6.1 Log schema

```markdown
| # | Date | Company | Role | Source / Link | Recipient email | Subject | Message file | Attachments | Sent at | Reply received |
```

| Column | Purpose |
|---|---|
| `#` | Monotonic row number, the identity of the send |
| `Date` | Date the send happened |
| `Company` | Employer name |
| `Role` | Exact role title as posted |
| `Source / Link` | URL the opening and the email were verified from |
| `Recipient email` | The verified address |
| `Subject` | Subject line actually sent |
| `Message file` | Path to the saved copy |
| `Attachments` | Resume PDF name |
| `Sent at` | Timezone-aware timestamp of the send |
| `Reply received` | `Yes` / `No` / `Bounced`, manually updated |

Additional log fields worth adding in a productised version: Gmail message ID,
Gmail thread ID, send attempt count, bounce reason, and verification outcome.

---

## 7. Stage 5, Drafting

### 7.1 Draft file format

One plain-text file per application. Metadata lives in a header, and only the
subject, body, and attachment are ever transmitted.

```
RECIPIENT: jobs@example.com
SUBJECT: Application for Software Engineer, Mohit Sharma

[EMAIL BODY START]

Hello Example team,

<180 to 220 words across 4 to 6 short paragraphs>

Mohit Sharma
Phone: +91 0000000000
Email: candidate@example.com
LinkedIn: https://linkedin.com/in/candidate
GitHub: https://github.com/candidate
Portfolio: https://candidate.example.com
```

The parser reads `RECIPIENT:`, `SUBJECT:`, and everything after the
`[EMAIL BODY START]` marker. The marker, the header lines, and the filename
are metadata and must never appear in the transmitted message.

### 7.2 Style rules, enforced per draft

These are correctness requirements, not preferences.

1. **Length:** 180 to 220 words, 4 to 6 short paragraphs, plain text.
2. **Voice:** first person, warm, polite, confident. Never begging, never
   self-deprecating, never apologetic.
3. **No AI tells.** Banned: "As an AI", "I am reaching out", "leverage",
   "cutting-edge", "state-of-the-art", "passionate", "I would love the
   opportunity to", "I hope this email finds you well", "dynamic professional".
4. **No dashes of any kind in the body.** No em dash, no en dash, no double
   hyphen. Use commas, periods, or the word "to".
5. **No metadata inside the body.** No "Attachment:", "Source:", "To:",
   "Subject:", "Link:" lines.
6. **No closing word.** No "Regards", "Best regards", "Sincerely", "Thanks".
   The body ends with the last sentence, then the signature block.
7. **Company-specific:** the real company name, the real role title, and 1 to
   2 genuine details from the posting or the company product. Generic
   openers like "I am writing to apply" must be varied across leads.
8. **Truthful claims only.** Tailor wording to the JD, never invent skills,
   projects, or experience. The internship is mentioned generically with no
   confidential project detail. The most recent real project is always named.
9. **No template reuse.** Two leads from the same stack must not share an
   opening sentence or paragraph structure.
10. **Fixed signature block**, identical on every email, with `https://` on
    every link and no education line.

### 7.3 Draft review

Drafts are written to disk and shown to the user before any send. No email is
ever queued without explicit per-draft approval. A draft linter should check
word count, banned phrases, dash characters, closing words, and signature
presence automatically, and block the queue on failure.

---

## 8. Stage 6, Approval

- The user reviews each draft individually, side by side with the source
  posting and the verified email address.
- Approve, edit and re-approve, or reject. Edit and regenerate must both
  exist.
- Approval is per draft. Approval of one draft never authorises another.
- A self-test send to the candidate's own address is valuable for verifying
  attachment rendering before the real queue starts.

---

## 9. Stage 7, Sending

### 9.1 Mechanics

1. Read the draft file path from arguments.
2. Load OAuth credentials.
3. Obtain a valid access token. If the stored token expires within 60 seconds,
   exchange the refresh token for a new one and write it back to disk.
4. Parse `RECIPIENT:`, `SUBJECT:`, and the body. Validate the recipient
   against an email regex. Fail loudly on a malformed draft.
5. Build a `multipart/mixed` MIME message: part 1 the plain-text body
   base64 encoded, part 2 the resume PDF base64 encoded as an attachment.
6. Base64url encode the entire MIME string: `+` to `-`, `/` to `_`, strip
   trailing `=`.
7. `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` with
   `Authorization: Bearer <token>` and body `{ "raw": "<base64url>" }`.
8. On success print `SENT_OK id=<messageId> threadId=<threadId> to=<recipient>`.

### 9.2 The sending script

```javascript
import { readFile, writeFile } from 'node:fs/promises';

const [draftPath] = process.argv.slice(2);
if (!draftPath) {
  console.error('Usage: node send-email.mjs <draft.txt>');
  process.exit(1);
}

const CREDS = 'C:\\Users\\Ankit Sharma\\.gmail-mcp\\credentials.json';
const KEYS = 'C:\\Users\\Ankit Sharma\\.gmail-mcp\\gcp-oauth.keys.json';
const RESUME = 'D:\\MohitJobApp\\resume\\Mohit_R_Sharma(Resume).pdf';
const FROM_EMAIL = 'candidate@example.com';
const FROM_NAME = 'Candidate Name';

const creds = JSON.parse(await readFile(CREDS, 'utf8'));
const keys = JSON.parse(await readFile(KEYS, 'utf8'));
const client = keys.installed;

async function getAccessToken() {
  const now = Date.now();
  if (creds.expiry_date && creds.expiry_date > now + 60000) return creds.access_token;
  const res = await fetch(client.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: creds.refresh_token,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Token refresh failed: ' + JSON.stringify(data));
  creds.access_token = data.access_token;
  creds.expiry_date = Date.now() + (data.expires_in || 3600) * 1000;
  await writeFile(CREDS, JSON.stringify(creds, null, 2));
  return creds.access_token;
}

const draft = await readFile(draftPath, 'utf8');
const recipient = (draft.match(/RECIPIENT:\s*(.+)/) || ['', ''])[1].trim();
const subject = (draft.match(/SUBJECT:\s*(.+)/) || ['', ''])[1].trim();
const body = draft.split('[EMAIL BODY START]')[1].trim();
if (!recipient || !subject || !body) {
  throw new Error('Draft missing RECIPIENT / SUBJECT / [EMAIL BODY START]');
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
  throw new Error('Recipient does not look like an email: ' + recipient);
}

const pdf = await readFile(RESUME);
const boundary = '----=_Part_' + Math.random().toString(16).slice(2, 12);
const CRLF = '\r\n';
const pdfName = 'Resume.pdf';

let mime = '';
mime += 'MIME-Version: 1.0' + CRLF;
mime += 'From: ' + FROM_NAME + ' <' + FROM_EMAIL + '>' + CRLF;
mime += 'To: ' + recipient + CRLF;
mime += 'Subject: ' + subject + CRLF;
mime += 'Date: ' + new Date().toUTCString() + CRLF;
mime += 'Content-Type: multipart/mixed; boundary="' + boundary + '"' + CRLF;
mime += CRLF;
mime += '--' + boundary + CRLF;
mime += 'Content-Type: text/plain; charset="UTF-8"' + CRLF;
mime += 'Content-Transfer-Encoding: base64' + CRLF;
mime += 'Content-Disposition: inline' + CRLF;
mime += CRLF;
mime += Buffer.from(body, 'utf8').toString('base64') + CRLF;
mime += '--' + boundary + CRLF;
mime += 'Content-Type: application/pdf; name="' + pdfName + '"' + CRLF;
mime += 'Content-Transfer-Encoding: base64' + CRLF;
mime += 'Content-Disposition: attachment; filename="' + pdfName + '"' + CRLF;
mime += CRLF;
mime += pdf.toString('base64') + CRLF;
mime += '--' + boundary + '--' + CRLF;

const raw = Buffer.from(mime, 'utf8')
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const token = await getAccessToken();
const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ raw }),
});
const data = await res.json();
if (!res.ok) throw new Error('Send failed: ' + JSON.stringify(data));
console.log('SENT_OK id=' + data.id + ' threadId=' + data.threadId + ' to=' + recipient);
```

---

## 10. Rate limiting, anti-spam, and bounce handling

These rules were written after a real failure and are the most important
operational constraints in the whole system.

### 10.1 The incident that produced these rules

An initial batch of 28 applications was sent with roughly 50 to 90 second
gaps. Gmail accepted every send, but one recipient
(`my@meteoros.in`) received a delivery failure reporting the message as
appearing suspicious. The API returning success does not mean the message was
delivered, and that distinction is easy to miss.

The user reported that five messages had bounced. Only the Meteoros bounce
was actually evidenced. All five were resent after the user confirmed, and
all five were accepted by the API. Delivery was never independently
confirmed. A "suspicious" rejection correlates with sender reputation and
sending pattern, not with the recipient's mail server, so an identical
resend is likely to be rejected again.

### 10.2 The rules

| Rule | Value | Status |
|---|---|---|
| Gap between sends | Random, **10 minutes minimum** | Written into `email-style-rules.md` |
| Latest user request | Random 4, 8, 10, 4 minutes, so 4 to 10 | **Contradicts the 10 minute minimum and must be resolved before the next batch** |
| Daily cap | 15 cold emails per day | Written into `email-style-rules.md` |
| Cooldown after any bounce or suspicious rejection | 48 hours, then resume at a reduced rate | Written into `email-style-rules.md` |
| Burst sending | Never | 28 sends at 50 second spacing caused the incident |
| Per-recipient frequency | One email per company unless the user explicitly asks for a second contact | Dedupe rule |

The contradiction on gap length is unresolved. The safer value is the 10
minute minimum, since the whole reason it was raised was bounce behaviour.

### 10.3 Volume context

Gmail's hard limits are roughly 500 messages per day for a personal account
and 2000 for Workspace, measured on a rolling 24 hour window. Exceeding them
can pause sending for 24 hours. These are safety ceilings, not targets. Safe
cold-email volume from a personal mailbox is far lower.

### 10.4 Unresolved cadence question

At the time of writing, 40 applications are logged, 35 saved copies exist
(resends reuse the original copy rather than creating a new one), and 12 sends
happened on a single day. For scale: an earlier statement in this chat claimed
17 sends that day and claimed the daily cap had been exceeded. Both numbers
were wrong. 12 is under the cap of 15. Recompute from the log before
enforcing any limit.

---

## 11. Gmail OAuth

### 11.1 Setup

1. Create a Google Cloud project at https://console.cloud.google.com
2. Enable the Gmail API under APIs and Services, Library.
3. Create credentials, OAuth client ID, application type **Desktop app**.
4. Save the downloaded JSON as `gcp-oauth.keys.json`. It has an `installed`
   object containing `client_id`, `client_secret`, `auth_uri`, `token_uri`,
   and `redirect_uris`.
5. Complete one OAuth flow as the Gmail account that will send, with scope
   `https://www.googleapis.com/auth/gmail.send`, and
   `access_type=offline` plus `prompt=consent` so a refresh token is issued.
6. Save the resulting tokens to `credentials.json` with `access_token`,
   `refresh_token`, `expiry_date` in epoch milliseconds, and `token_type`.

### 11.2 Token expiry

Access tokens live about one hour. The refresh token is long lived but is
revoked if the user revokes access, changes the password, or if the OAuth
consent is in the **Testing** publishing state, in which case refresh tokens
expire after about seven days. Publishing the OAuth app in the Google Cloud
console removes that seven day expiry. Confirming the publishing state is an
open item.

### 11.3 The reauthorization script

A local HTTP server on a fixed port, currently 8888, serves the redirect,
builds the consent URL, opens the browser, exchanges the returned code for
tokens, and writes `credentials.json`. The exact error it exists to solve:

```
Error: Token refresh failed: {"error":"invalid_grant",
  "error_description":"Token has been expired or revoked."}
```

Recovery is to re-run the flow. A sending pipeline must detect `invalid_grant`
and surface a clear "reauthorize required" state rather than retrying.

---

## 12. Architecture

### 12.1 Manual implementation, as built

```
D:\MohitJobApp\
  drafts\                         one .txt per application, header plus body
  sent\                           saved copy of every sent email
  logs\
    application-log.md            the dedupe source of truth
  resume\
    Mohit_R_Sharma(Resume).pdf    attached to every email
  scripts\
    send-email.mjs                Gmail sender
    refresh-gmail-token.mjs       OAuth reauthorization helper
  email-style-rules.md            writing and sending rules
  jobs-found.md                   lead tracker with verification outcomes
  SYSTEM.md                       the manual setup guide
  APP-SPEC.md                     this document
```

### 12.2 Productised target

TypeScript monorepo, one language end to end.

| Layer | Choice | Responsibility |
|---|---|---|
| Frontend | React + Vite + Tailwind | Lead list, draft review, approval, dashboard |
| Backend | Node + Express or NestJS | Auth, leads, verification, drafts, queue, tracking |
| Database | PostgreSQL with Prisma or Drizzle | Users, resumes, leads, drafts, send log, verification records |
| Auth | Session or JWT | Application login, separate from Google OAuth |
| Gmail | Official Gmail REST API, or raw fetch OAuth as in section 9 | Send, optionally read for replies |
| LLM | Provider-agnostic OpenAI-compatible client | Draft generation, lead summarisation |
| Resume parsing | `pdf-parse` plus user-structured fields | Extract name, education, experience, skills, links |
| Validation | Zod | Every boundary, plus email format validation |
| Scheduling | BullMQ or a simple DB-backed queue | Rate-limited send queue with pause and resume |
| Storage | Local disk or S3-compatible object store | Resume and sent copies |

### 12.3 Data model

```prisma
model User {
  id           String
  email        String  @unique
  name         String
  gmailTokens  Json?            // encrypted at rest
  resumes      Resume[]
  profile      Profile?
  leads        Lead[]
  createdAt    DateTime
}

model Profile {
  userId        String @id
  phone         String
  email         String
  linkedinUrl   String
  githubUrl     String
  portfolioUrl  String
  allowedCities String[]        // location allowlist
  remoteOk      Boolean
  signature     String          // the fixed signature block
  skills        String[]
  disallowSkills String[]       // e.g. Flask
}

model Resume {
  id       String
  userId   String
  fileName String
  path     String
  rawText  String
  isActive Boolean
}

model Lead {
  id          String
  userId      String
  company     String
  role        String
  location    String
  type        String           // internship | full time
  sourceUrl   String           // where the opening was found
  jd          String
  stack       String[]

  // verification
  email            String?
  emailSourceUrl   String?
  verifyStatus     VerifyStatus
  verifyReason     String?      // why it failed, for rejected leads

  matchScore     Int?
  status         LeadStatus     // new | verified | drafted | approved | sent | replied | rejected
  createdAt      DateTime

  draft          Draft?
  sends          SendLog[]
}

model Draft {
  id       String
  leadId   String
  subject  String
  body     String
  wordCount Int
  linterPassed Boolean
  approved Boolean
  approvedAt DateTime?
  model    String?
}

model SendLog {
  id        String
  leadId    String
  rowNumber Int          // the # column in the markdown log
  recipient String
  subject   String
  sentAt    DateTime
  gmailMessageId  String?
  gmailThreadId   String?
  attachmentName  String?
  savedCopyPath   String
  attempt   Int         // 1 for first send, 2+ for a bounce resend
  outcome   String      // SENT_OK | BOUNCED
}

enum VerifyStatus {
  PENDING
  FOUND_ON_COMPANY_SITE
  EMAIL_NOT_FOUND
  ROLE_CLOSED
  COMPANY_UNVERIFIABLE
  PORTAL_ONLY
  IN_APP_ONLY
  NON_HR_ADDRESS
  OUT_OF_SCOPE_LOCATION
  STACK_MISMATCH
}

enum LeadStatus {
  NEW VERIFIED DRAFTED APPROVED SENT REPLIED REJECTED
}
```

### 12.4 Environment configuration

```
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:8888
DATABASE_URL=postgresql://...
LLM_API_KEY=
AI_PROVIDER=openai-compatible
AI_MODEL=
APP_URL=http://localhost:3000

# rate limiting, defaults match section 10.2
SEND_MIN_GAP_MINUTES=10
SEND_DAILY_CAP=15
SEND_COOLDOWN_HOURS=48
```

---

## 13. Milestones

| Milestone | Deliverable | Depends on |
|---|---|---|
| M0 Skeleton | Monorepo, Prisma schema, auth, Docker, README | none |
| M1 Profile and resume | Upload, parse, structured edit, allowlist config | M0 |
| M2 Leads | CRUD, CSV import, statuses, dedupe guard | M1 |
| M3 Verification engine | Source-URL-required email entry, outcome enum, rejection reasons, search-and-fetch tools | M2 |
| M4 Matching and scoring | Hard filters, soft score, lead queue view | M2 |
| M5 Gmail OAuth | Connect, refresh, revoke, `invalid_grant` recovery | M0 |
| M6 Draft engine | Prompt, style linter, per-company uniqueness seed, inline edit and regenerate | M1, M3 |
| M7 Review and approval | Side-by-side preview, approval gate, self-test send | M6 |
| M8 Sending | MIME builder, single send, rate-limited queue, pause/resume, atomic sent marking | M5, M7 |
| M9 Tracking | Reply detection, follow-up drafts, dashboard stats, bounce flagging | M8 |
| M10 Discovery | Scheduled X, LinkedIn, aggregator scans feeding the lead queue | M3 |

The ordering principle is that verification (M3) must land before drafting
(M6), and approval (M7) before sending (M8). Everything else is conventional
application work.

---

## 14. Acceptance criteria

A build is correct if all of the following hold. These are testable.

1. **No fabrication.** No email ever reaches the queue without a recorded
   source URL. A test submits a lead with an invented address and no URL and
   asserts the request is rejected.
2. **No template reuse.** Two leads from the same stack produce different
   opening sentences and different paragraph structures.
3. **Linter enforcement.** A draft containing an em dash, "Regards",
   "passionate", or a body over 220 words fails the linter and cannot be
   approved.
4. **Approval gate.** An unapproved draft is never sent, even by direct API
   call to the send endpoint.
5. **Attachment correctness.** The sent message is a valid
   `multipart/mixed` with a `text/plain` part and a PDF part, decodable back to
   the original resume bytes.
6. **No double send.** A lead already marked `sent` cannot be re-sent. A
   repeated send attempt raises rather than duplicating.
7. **Rate limiting.** The queue never issues two sends closer together than
   the configured minimum gap, and never exceeds the daily cap. These are
   enforced by the queue, not by convention.
8. **Cooldown.** After a bounce is recorded, the queue refuses to send for
   the cooldown period.
9. **Token recovery.** An `invalid_grant` response puts the account into a
   reauthorization-required state with a working recovery path, not an
   infinite retry loop.
10. **Truthfulness.** Generated drafts contain no skill, project, or employer
    absent from the stored profile and resume.
11. **Rejection audit.** Every rejected lead stores a reason, and re-running
    discovery does not re-open an already rejected lead.

---

## 15. Hard-won lessons

Distilled from the real runs. These are the parts a fresh implementation
usually gets wrong.

1. **API success is not delivery.** The Gmail API returns `SENT_OK` for
   messages that Gmail then flags as suspicious. Delivery status is a separate
   signal that this system does not yet read, so bounce monitoring is manual.
2. **Burst sending is the single biggest risk.** 28 applications at 50 second
   spacing produced a suspicious rejection. Spacing is not a politeness
   detail, it is the core control.
3. **Roundups are not openings.** An X post listing six internships is a
   third-party compilation, often with truncated links and stale dates. It is
   a lead source, never proof of a live vacancy.
4. **Truncated links must be resolved, never completed.** Guessing the rest
   of a Wellfound URL from a partial slug produced 410 responses. A dead link
   discovered once should be recorded so it is never re-fetched.
5. **The best inbox is a published HR inbox.** A surprisingly small share of
   companies publish one. When they do, it is usually labelled
   unambiguously, as with 42Gears' "email us your latest resume".
6. **Non-HR addresses exist and must be rejected.** Privacy, DPO, POSH,
   support, sales and press addresses are published constantly and must never
   receive a resume.
7. **Companies advertised on X sometimes do not exist.** A recruiter posted
   openings for a company with no website, no footprint, and no verifiable
   presence. Existence checking is mandatory.
8. **Premise errors propagate.** Two companies were researched under assumed
   descriptions (a Gulf business-setup firm described as an Indian dev
   platform, a Gurugram commerce app described as a Bangalore dev-tools
   company). Always verify what the company actually is.
9. **Keep arithmetic honest.** Daily counts were misreported in this chat
   twice, producing a false "we are over the cap" warning. Derive counts from
   the log, never from memory.
10. **Deliberate scope cuts are fine.** Portal form auto-filling was discussed
    and explicitly deferred. Recording a deferred feature as deferred prevents
    scope creep and false claims.

---

## 16. Explicitly out of scope

- Browser automation to fill and submit Naukri, LinkedIn, Wellfound, or
  employer ATS forms. Discussed as a future local Playwright project with a
  logged-in profile, 8 to 10 applications per platform, human-paced delays,
  CAPTCHA pauses and no CAPTCHA bypass. It is **not built**.
- Reply auto-reply drafting (follow-up bumps are specified but require the
  same approval gate as first sends).
- Multi-user SaaS hardening, billing, and multi-tenant isolation. The design
  supports it; the manual implementation is single user.
- A hosted deployment. Everything runs locally.

---

## 17. Current state of the concrete instance

- 40 logged applications, 35 saved copies, 12 sends on the most recent day.
- Sending account: `mohit.sharma.dev2580@gmail.com`.
- Credentials: `C:\Users\Ankit Sharma\.gmail-mcp\`.
- Resume: `D:\MohitJobApp\resume\Mohit_R_Sharma(Resume).pdf`.
- The 14 remaining verified X-sourced leads and the 12-company fresher
  full-time batch are queued, drafted, or awaiting drafting as tracked in
  `jobs-found.md` and the drafts folder.
- The Google OAuth app publishing state is unconfirmed, so the seven day
  refresh token expiry may still apply.
- The send gap contradiction in section 10.2 is unresolved and blocks the
  next batch until decided.
