import { readFile, writeFile } from 'node:fs/promises';

const [draftPath] = process.argv.slice(2);
if (!draftPath) {
  console.error('Usage: node send-email.mjs <draft.txt>');
  process.exit(1);
}

const CREDS = 'C:\\Users\\Ankit Sharma\\.gmail-mcp\\credentials.json';
const KEYS = 'C:\\Users\\Ankit Sharma\\.gmail-mcp\\gcp-oauth.keys.json';
const RESUME = 'D:\\MohitJobApp\\resume\\YOUR_RESUME.pdf';
const FROM_EMAIL = 'YOUR_EMAIL@gmail.com';
const FROM_NAME = 'Your Name';

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
const pdfName = 'YOUR_RESUME.pdf';

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


