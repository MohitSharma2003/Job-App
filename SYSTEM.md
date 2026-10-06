# Email Application System — Complete Documentation

This document describes the full email application system built for Mohit Sharma:
what it does, how it works, how it was set up, and how to recreate the same
environment from scratch.

---

## 1. What this system does

This system sends individually drafted job application emails from Mohit's own
Gmail account, with his resume PDF attached, for verified fresher/intern
openings in allowed Indian cities plus remote roles.

The complete workflow is:

1. **Find openings** (LinkedIn, job portals, direct leads) that fit Mohit.
2. **Verify a real recipient email** for each opening. Never fabricate an
   address; only use an email literally found in the job posting or on the
   company site.
3. **Draft one human-looking email per company** (no templates, no AI phrases,
   custom structure per company).
4. **Get Mohit's approval** of the drafts.
5. **Send one email at a time** via Gmail API, spaced at random 10+ minute
   intervals to avoid spam flags.
6. **Save a copy** of every sent message in `sent/`.
7. **Log every send** in `logs/application-log.md`.
8. Respect anti-spam cooldowns (see section 7).

Current state: 34 logged applications sent from Mohit's Gmail account.

---

## 2. Folder structure

```
D:\MohitJobApp\
  drafts\                       one file per application (RECIPIENT/SUBJECT + body)
  sent\                         saved copy of every sent email
  logs\
    application-log.md          master send log (markdown table)
  resume\
    Mohit_R_Sharma(Resume).pdf  the resume attached to every email
  scripts\
    send-email.mjs              the Gmail API sender script
  email-style-rules.md          writing + sending rules
  jobs-found.md                 lead list with status (found / applied / skipped)
  SYSTEM.md                     this file
```

---

## 3. What the setup requires (prerequisites)

### 3.1 Node.js
- Node.js (v22+ recommended). Verify with `node --version`.

### 3.2 A Gmail account (free personal account is fine)
- The account owns the emails sent by the system.

### 3.3 Google Cloud OAuth credentials
To send email through the Gmail API you need a Google Cloud project with the
Gmail API enabled:

1. Go to the Google Cloud Console: https://console.cloud.google.com
2. Create a project (or reuse one).
3. Enable the **Gmail API** under APIs & Services > Library.
4. Under APIs & Services > Credentials > Create Credentials > OAuth client ID:
   - Application type: **Desktop app** (this produces an `installed` client).
   - Download the JSON file. It will look like:
     ```json
     {
       "installed": {
         "client_id": "...",
         "client_secret": "...",
         "auth_uri": "https://accounts.google.com/o/oauth2/auth",
         "token_uri": "https://oauth2.googleapis.com/token",
         "redirect_uris": ["http://localhost"]
       }
     }
     ```
5. This file is referred to as `gcp-oauth.keys.json` in this system.

### 3.4 OAuth tokens for the Gmail account
Two tokens are needed: an `access_token` (short lived, ~1 hour) and a
`refresh_token` (long lived) for the target Gmail account.

The simplest way to obtain them is to complete one manual OAuth flow with the
Gmail MCP server (this project originally used it), which writes a
`credentials.json` like:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expiry_date": 1730000000000,
  "token_type": "Bearer",
  "scope": "...gmail.send..."
}
```

Required Gmail scope (at minimum): `https://www.googleapis.com/auth/gmail.send`

Once `credentials.json` exists, all further sending is fully automatic. The
script refreshes the access token by itself using the refresh token.

---

## 4. The sending script (`scripts/send-email.mjs`)

### What it does, step by step

1. Reads the draft file path from the command line.
2. Loads `credentials.json` and `gcp-oauth.keys.json`.
3. Gets a valid access token:
   - If the stored token is still valid (expiry_date > now + 60s), reuse it.
   - Otherwise call `token_uri` with `grant_type=refresh_token` to get a new
     access token, then save it back to `credentials.json` (auto-refresh).
4. Parses the draft file:
   - `RECIPIENT: <email>` line.
   - `SUBJECT: <subject>` line.
   - Text after `[EMAIL BODY START]` = the body.
   - Validates recipient format.
5. Builds a MIME `multipart/mixed` message:
   - Part 1: the plain-text body (base64).
   - Part 2: the resume PDF attachment (base64).
6. Base64-url-encodes the whole MIME string (`+` -> `-`, `/` -> `_`, strips
   trailing `=`).
7. POSTs to the Gmail API:
   `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
   with `Authorization: Bearer <access_token>`.
8. Prints `SENT_OK id=... threadId=... to=...` on success.

### How to run it

```powershell
node "D:\MohitJobApp\scripts\send-email.mjs" "D:\MohitJobApp\drafts\29-flodata-analytics-fullstack.txt"
```

### Code (full listing)

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
const FROM_EMAIL = 'mohit.sharma.dev2580@gmail.com';
const FROM_NAME = 'Mohit Sharma';

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
const pdfName = 'Mohit_R_Sharma(Resume).pdf';

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

const raw = Buffer.from(mime, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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

## 5. Draft file format

Every draft has an internal metadata block followed by the body. Only the
subject, body, and resume attachment are ever sent (no metadata lines, no
"To:/Attachment:/Source:" lines in the email).

```
RECIPIENT: hr@example.com
SUBJECT: Application for Full Stack Developer Intern, Mohit Sharma

[EMAIL BODY START]

Hello Example team,

<email body>

Mohit Sharma
Phone: +91 7249496453
Email: mohit.sharma.dev2580@gmail.com
LinkedIn: https://linkedin.com/in/mohit-sharma-81a1ab256
GitHub: https://github.com/MohitSharma2003
Portfolio: https://mohitsharmaa.vercel.app
```

---

## 6. Email writing rules (summary of `email-style-rules.md`)

- Human, first-person voice; warm but professional; polite and confident.
- 180 to 220 words, 4 to 6 short paragraphs, plain text.
- No AI phrases ("As an AI", "leverage", "passionate", "cutting-edge").
- No dashes of any kind (em dash, en dash, double hyphen) anywhere.
- No closing word (no Regards / Best regards / Thanks). Email ends with the
  last sentence, then the signature block.
- Mention the real company name, real role title, and 1 to 2 genuine details
  from the posting.
- Only claim real skills: MERN, PostgreSQL, REST APIs, Docker, Git/GitHub,
  TypeScript. Python only where the posting asks; Go only if relevant.
- Never mention Flask.
- Never same template twice; vary structure and wording per company.
- Signature block always the same, no education line.

---

## 7. Anti-spam sending mechanics (IMPORTANT — learned the hard way)

These rules were written after a real bounce: 17 similar cold emails with the
same attachment sent in one burst triggered Google's "appears suspicious"
rejection on one recipient (`my@meteoros.in`).

- **Spacing:** one email at a time, random 10+ minute gaps. Never burst 15+
  emails within minutes.
- **Daily cap:** max 15 cold emails per day from a personal Gmail (hard limit
  is 500/day, but safe cold volume is far lower).
- **Cooldown after a bounce/flag:** stop all sends for 48 hours, then resume
  at 15/day. After a long idle gap, restart low.
- **Variation:** identical structure + same attachment across many sends
  within a short window triggers filters even under the cap.
- **Hard Gmail limits (for context):** personal @gmail.com ~500 emails/day
  rolling 24h; Workspace ~2000/day. Exceeding can pause sending for 24h.
- If a mail bounces as spam-linked, resending identical content is likely to
  bounce again.

---

## 8. How to recreate this environment from scratch

### Step 1 — Install Node.js
Install Node.js v22+ from https://nodejs.org. Verify: `node --version`.

### Step 2 — Create Google Cloud project + OAuth keys
1. https://console.cloud.google.com > create project.
2. Enable Gmail API (Library > Gmail API > Enable).
3. Credentials > Create credentials > OAuth client ID > Desktop app > create.
4. Download JSON, save as `gcp-oauth.keys.json`.

### Step 3 — Get tokens for your Gmail account
Run one manual OAuth flow (e.g., with an OAuth playground or the Gmail MCP)
as the Gmail account that will send. Save the resulting tokens to
`credentials.json` with at least:
- `access_token`
- `refresh_token`
- `expiry_date` (epoch ms)

Scope needed: `https://www.googleapis.com/auth/gmail.send`

### Step 4 — Create the project folders
```
D:\JobApplicant\
  drafts\
  sent\
  logs\
  resume\
  scripts\
```
Put the real resume PDF in `resume\`.

### Step 5 — Copy `send-email.mjs` and customize
Edit the constants at the top:
- `CREDS`, `KEYS`, `RESUME` paths.
- `FROM_EMAIL`, `FROM_NAME`.

### Step 6 — Create the supporting files
- `email-style-rules.md` (writing + sending rules; see section 6 and 7).
- `logs/application-log.md` with the table header:
  `| # | Date | Company | Role | Source / Link | Recipient email | Subject | Message file | Attachments | Sent at | Reply received |`
- `jobs-found.md` for tracking leads.

### Step 7 — Test send
Create one test draft and run:
```powershell
node "D:\JobApplicant\scripts\send-email.mjs" "D:\JobApplicant\drafts\test.txt"
```
Check the recipient's inbox (or your own Sent folder) for the email + resume.

### Step 8 — Operate the workflow
1. Find openings allowed for the candidate (cities + remote).
2. Verify recipient emails from the posting or company site only.
3. Draft unique emails, get approval.
4. Send one at a time with 10+ minute random gaps.
5. Save copies to `sent\`, append log rows.
6. Respect daily caps and cooldowns.

---

## 9. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `Token refresh failed` | Refresh token invalid/revoked | Re-run the OAuth flow; check scope includes gmail.send |
| `Send failed: 401` | Access token rejected | The script should auto-refresh; if not, delete credentials.json access_token so it refreshes |
| `Message not delivered ... appears suspicious` | Spam filter flagged the send | Stop 48h, reduce volume, vary wording, space 10+ min |
| Draft missing RECIPIENT/SUBJECT | Malformed draft file | Check header lines and the `[EMAIL BODY START]` marker |
| Sends succeed but land in recipient spam | Sender reputation | Space sends more, personalize more, reduce daily volume |

---

## 10. Notes on this specific deployment

- Sending account: `mohit.sharma.dev2580@gmail.com`.
- Credentials live at `C:\Users\Ankit Sharma\.gmail-mcp\` (do not delete).
- Resume: `D:\MohitJobApp\resume\Mohit_R_Sharma(Resume).pdf`.
- 34 applications logged as of 2026-09-24.
- The Gmail MCP was used originally just to obtain the OAuth tokens; all
  sending now goes through `send-email.mjs` directly.