import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const [draftPath] = process.argv.slice(2);
if (!draftPath) { console.error('Usage: node scripts/send-email.mjs drafts/file.txt'); process.exit(1); }

const CREDS = join(homedir(), '.gmail-mcp', 'credentials.json');
const KEYS  = join(homedir(), '.gmail-mcp', 'gcp-oauth.keys.json');
const root  = process.cwd();
const RESUME = join(root, 'resume', process.env.JOB_APP_RESUME || 'YOUR_RESUME.pdf');
const FROM_EMAIL = process.env.JOB_APP_EMAIL || 'YOUR_EMAIL@gmail.com';
const FROM_NAME  = process.env.JOB_APP_NAME  || 'Your Name';

const creds = JSON.parse(await readFile(CREDS, 'utf8'));
const keys  = JSON.parse(await readFile(KEYS, 'utf8'));
const client = keys.installed;

async function token() {
  const now = Date.now();
  if (creds.expiry_date && creds.expiry_date > now + 60000) return creds.access_token;
  const res = await fetch(client.token_uri, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'refresh_token', client_id:client.client_id, client_secret:client.client_secret, refresh_token:creds.refresh_token}) });
  const data = await res.json();
  if (!res.ok) throw new Error('Token refresh failed: '+JSON.stringify(data));
  creds.access_token = data.access_token; creds.expiry_date = Date.now()+((data.expires_in||3600)*1000); await writeFile(CREDS, JSON.stringify(creds,null,2)); return creds.access_token;
}

const draft = await readFile(draftPath, 'utf8');
const to = (draft.match(/RECIPIENT:\s*(.+)/)||['',''])[1].trim();
const subj = (draft.match(/SUBJECT:\s*(.+)/)||['',''])[1].trim();
const body = draft.split('[EMAIL BODY START]')[1].trim();
if (!to||!subj||!body) throw new Error('Bad draft');
const pdf = await readFile(RESUME);
const b = 'b_'+Math.random().toString(16).slice(2);
const CR='\r\n';
let mime=''; mime+='MIME-Version:1.0'+CR+'From: '+FROM_NAME+' <'+FROM_EMAIL+'>'+CR+'To: '+to+CR+'Subject: '+subj+CR+'Date: '+new Date().toUTCString()+CR+'Content-Type: multipart/mixed; boundary="'+b+'"'+CR+CR+'--'+b+CR+'Content-Type:text/plain;charset=UTF-8'+CR+'Content-Transfer-Encoding:base64'+CR+CR+Buffer.from(body,'utf8').toString('base64')+CR+'--'+b+CR+'Content-Type:application/pdf; name=resume.pdf'+CR+'Content-Transfer-Encoding:base64'+CR+'Content-Disposition:attachment;filename=resume.pdf'+CR+CR+pdf.toString('base64')+CR+'--'+b+'--'+CR;
const raw = Buffer.from(mime,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const t = await token();
const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({raw})});
const d = await r.json(); if(!r.ok) throw new Error(JSON.stringify(d));
console.log('SENT_OK id='+d.id);
