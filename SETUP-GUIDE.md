# Quick Start Guide: Opencode + Gmail Auto Email System

This is a minimal, copy-pasteable setup guide for someone else to run the exact email application system on their own Windows machine.

Prerequisites: Node.js v22+, a Gmail account, and about 30 minutes.

---

## 1. Install Node.js

1. Download from [nodejs.org](https://nodejs.org/) (LTS recommended)
2. Install with defaults
3. Verify: `node --version` and `npm --version`

---

## 2. Download/Copy the Project

Copy this entire folder to your machine:

```text
Job-App\
```

Keep the same structure. On Windows, a good location is `%JOB_APP_DIR%\` or `C:\Users\<You>\Documents\Job-App\`.

Note: scripts use relative paths and environment-aware values. You may also edit scripts/send-email.mjs if needed in `scripts/send-email.mjs` if you move it (see section 6).

---

## 3. Create Google Cloud OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (top-left dropdown > New Project)
3. Enable Gmail API: APIs & Services > Library > search "Gmail API" > Enable
4. Go to APIs & Services > Credentials > Create Credentials > OAuth client ID
5. If prompted, configure OAuth consent screen first:
   - User Type: External (for personal Gmail)
   - App name: Job Email App
   - User support email: your Gmail
   - Developer contact: your Gmail
   - Save/Continue through scopes (can skip adding scopes here)
6. Back to Credentials > Create OAuth client ID
   - Application type: **Desktop app**
   - Name: `job-email-desktop`
7. Download JSON. Save as `gcp-oauth.keys.json`

Place it here:
```text
%USERPROFILE%\\.gmail-mcp\gcp-oauth.keys.json
```

Create the `.gmail-mcp` folder if it doesn't exist.

The file should look like:
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

---

## 4. Get Gmail OAuth Tokens (First-Time Authorization)

We need `access_token` + `refresh_token` written to `credentials.json`.

Run the reauthorization script:

```powershell
node "%JOB_APP_DIR%\scripts\refresh-gmail-token.mjs"
```

It will:
1. Open your default browser to Google OAuth consent
2. Sign in with the Gmail account you want to send from
3. Grant permission ("Send email on your behalf")
4. Redirect to `http://localhost:8888` (local server auto-handles it)
5. Write tokens to `%USERPROFILE%\\.gmail-mcp\credentials.json`

**Important:** If Google shows "App isn't verified", click "Advanced > Go to [App Name] (unsafe)" to proceed (this is normal for a personal Desktop app not published to Google).

If you get `invalid_grant` later, just run this script again.

---

## 5. Prepare Your Resume and Profile

1. Put your resume PDF at:
```text
%JOB_APP_DIR%\resume\Mohit_R_Sharma(Resume).pdf
```
Rename it to your own filename if desired, but update `send-email.mjs` (section 6).

2. Edit your details in the signature block (appears in every draft). Look in `email-style-rules.md` and in your drafts.

---

## 6. Configure Paths (If You Moved Folders)

Edit `scripts/send-email.mjs` lines 9–14:

```javascript
const CREDS = 'C:\\Users\\<YourUsername>\\.gmail-mcp\\credentials.json';
const KEYS  = 'C:\\Users\\<YourUsername>\\.gmail-mcp\\gcp-oauth.keys.json';
const RESUME = 'D:\\Job-App\\resume\\Your_Resume.pdf';
const FROM_EMAIL = 'youremail@gmail.com';
const FROM_NAME  = 'Your Name';
```

Edit `scripts/refresh-gmail-token.mjs` if paths differ (CREDS/KEYS lines).

---

## 7. Test the Setup

Create a test draft:

```text
%JOB_APP_DIR%\drafts\test.txt
```

```text
RECIPIENT: youremail@gmail.com
SUBJECT: Test Email

[EMAIL BODY START]

Hello team,

This is a test email from the job application system.

Your Name
Phone: +91 XXXXX XXXXX
Email: youremail@gmail.com
LinkedIn: https://linkedin.com/in/yourprofile
GitHub: https://github.com/yourgithub
Portfolio: https://yourportfolio.com
```

Send it:

```powershell
node "%JOB_APP_DIR%\scripts\send-email.mjs" "%JOB_APP_DIR%\drafts\test.txt"
```

Expected output:
```text
SENT_OK id=... threadId=... to=youremail@gmail.com
```

Check your Gmail Sent folder. If it arrives with the PDF attached, you're good.

---

## 8. How to Use (Daily Workflow)

### A. Find leads
Search LinkedIn/X, verify email is **literally** on company site/posting (never guess). Record source URL.

### B. Create a draft
Create a new `.txt` in `drafts/` following the format in section 5 of SYSTEM.md. Follow `email-style-rules.md` (180–220 words, 4–6 paragraphs, no dashes, no AI phrases).

### C. Approve
Read the draft. Fix if needed. Never send unapproved.

### D. Send (one at a time, with spacing)
Send one email:

```powershell
node "%JOB_APP_DIR%\scripts\send-email.mjs" "%JOB_APP_DIR%\drafts\XX-company.txt"
```

Wait **10 minutes minimum** (recommended) before next. For random 4–10 min, use PowerShell sleep:

```powershell
Start-Sleep -Seconds (Get-Random -Minimum 240 -Maximum 600)
```

**Rules:** Max 15 emails/day. If any bounce/flag ? STOP for 48 hours.

### E. Log and archive
After sending successfully, copy draft to `sent/` with a clean name:

```powershell
Copy-Item "%JOB_APP_DIR%\drafts\XX-company.txt" "%JOB_APP_DIR%\sent\XX-CompanyName.txt" -Force
```

Append a new row to `logs\application-log.md` with: #, Date, Company, Role, Source/Link, Recipient, Subject, Message file, Attachments, Sent at, Reply received.

---

## 9. Safety & Anti-Spam Checklist

- [ ] Only send to emails you **literally found** (source URL recorded)
- [ ] One email at a time, 10 min minimum gap between sends
- [ ] Max 15 cold emails/day
- [ ] 48-hour cooldown if bounce/flag
- [ ] Each draft unique (never identical body to different companies)
- [ ] No dashes, no AI phrases, plain text, 180–220 words
- [ ] Never send same (company+recipient) twice (check log first)

---

## 10. Troubleshooting

| Error | Fix |
|---|---|
| `Token refresh failed: invalid_grant` | Run `refresh-gmail-token.mjs` again (reauthorize) |
| `Send failed: 401` | Re-run refresh script. Token expired (~1 hour) — auto-refresh usually handles it |
| `Draft missing RECIPIENT/SUBJECT` | Check header and `[EMAIL BODY START]` marker |
| Browser doesn't open on reauth | Manually open the URL printed in terminal |
| Gmail says "less secure apps" / blocked | You're using OAuth (secure). If blocked, check Google Cloud publishing state (Testing vs Published). For personal use, Testing is fine if refresh token not expired |

---

## 11. Files You Need (Reference)

- `scripts/send-email.mjs` — sender
- `scripts/refresh-gmail-token.mjs` — token reauth
- `email-style-rules.md` — writing rules (must follow)
- `SYSTEM.md` — full detailed docs
- `APP-SPEC.md` — architecture/spec for rebuilding as an app
- `logs/application-log.md` — source of truth (dedupe)
- `drafts/`, `sent/`, `resume/` — working folders

---

## 12. One-Command Reauth (if needed)

```powershell
node "%JOB_APP_DIR%\scripts\refresh-gmail-token.mjs"
```

That's it. You're set up exactly like the working system.



