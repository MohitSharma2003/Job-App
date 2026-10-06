import { readFile } from 'node:fs/promises';

const CREDS = 'C:\\Users\\Ankit Sharma\\.gmail-mcp\\credentials.json';
const KEYS = 'C:\\Users\\Ankit Sharma\\.gmail-mcp\\gcp-oauth.keys.json';

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
  return data.access_token;
}

const token = await getAccessToken();
const res = await fetch(
  'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&q=' +
    encodeURIComponent('in:sent newer_than:1d'),
  { headers: { Authorization: 'Bearer ' + token } },
);
const data = await res.json();
if (!res.ok) throw new Error('List failed: ' + JSON.stringify(data));

for (const m of data.messages || []) {
  const d = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + m.id +
      '?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date',
    { headers: { Authorization: 'Bearer ' + token } },
  );
  const detail = await d.json();
  const h = detail.payload?.headers || [];
  const get = (n) => h.find((x) => x.name.toLowerCase() === n)?.value || '';
  console.log([m.id, get('Date'), get('To'), get('Subject')].join(' | '));
}
