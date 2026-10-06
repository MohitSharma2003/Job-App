import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createServer } from 'node:net';
import { exec } from 'node:child_process';
import { dirname } from 'node:path';

const CREDS = 'C:\\Users\\Ankit Sharma\\.gmail-mcp\\credentials.json';
const KEYS = 'C:\\Users\\Ankit Sharma\\.gmail-mcp\\gcp-oauth.keys.json';
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

const keys = JSON.parse(await readFile(KEYS, 'utf8'));
const client = keys.installed;

try { await readFile(CREDS, 'utf8'); } catch {
  await writeFile(CREDS, JSON.stringify({
    token_type: 'Bearer',
    refresh_token: '',
    access_token: '',
    expiry_date: 0,
    scope: SCOPE,
    client_id: client.client_id,
    client_secret: client.client_secret,
    type: 'authorized_user',
  }, null, 2));
}

const port = 8888;

const redirectUri = 'http://localhost:' + port;

const authUrl = client.auth_uri + '?' + new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent',
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/') {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (err) {
    res.writeHead(400).end('Authorization failed: ' + err);
    console.error('AUTH ERROR:', err);
    process.exit(1);
  }
  if (!code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h3>Waiting for the authorization redirect...</h3>');
    return;
  }

  const tokenRes = await fetch(client.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await tokenRes.json();

  if (!tokenRes.ok || !data.refresh_token) {
    res.writeHead(500).end('Token exchange failed: ' + JSON.stringify(data));
    console.error('TOKEN EXCHANGE FAILED:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const creds = {
    token_type: data.token_type || 'Bearer',
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    expiry_date: Date.now() + (data.expires_in || 3600) * 1000,
    scope: data.scope || SCOPE,
    client_id: client.client_id,
    client_secret: client.client_secret,
    type: 'authorized_user',
  };
  await writeFile(CREDS, JSON.stringify(creds, null, 2));

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h3>Authorization complete. You can close this tab.</h3>');
  console.log('SUCCESS: new tokens written to credentials.json');
  server.close();
  process.exit(0);
});

server.listen(port, '127.0.0.1', () => {
  console.log('Opening browser for Gmail authorization...');
  console.log('URL: ' + authUrl);
  exec('start "" "' + authUrl + '"', (e) => {
    if (e) console.error('Auto-open failed, open the URL manually.');
  });
});


