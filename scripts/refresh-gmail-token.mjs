import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CREDS = join(homedir(), '.gmail-mcp', 'credentials.json');
const KEYS  = join(homedir(), '.gmail-mcp', 'gcp-oauth.keys.json');
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

const keys = JSON.parse(await readFile(KEYS, 'utf8'));
const client = keys.installed;

try { await readFile(CREDS,'utf8'); } catch { await writeFile(CREDS, JSON.stringify({token_type:'Bearer',refresh_token:'',access_token:'',expiry_date:0,scope:SCOPE,client_id:client.client_id,client_secret:client.client_secret,type:'authorized_user'},null,2)); }

const port=8888;
const redirect='http://localhost:'+port;
const authUrl = client.auth_uri+'?'+new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent'});

const server = http.createServer(async (req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname!=='/'){res.writeHead(404).end();return;}
  const code=url.searchParams.get('code'); const err=url.searchParams.get('error');
  if(err){res.writeHead(400).end('err');console.error(err);process.exit(1);}
  if(!code){res.writeHead(200,{'Content-Type':'text/html'});res.end('<h3>Waiting...</h3>');return;}
  const tr=await fetch(client.token_uri,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:client.client_id,client_secret:client.client_secret,redirect_uri:redirect,grant_type:'authorization_code'})});
  const td=await tr.json();
  if(!tr.ok||!td.refresh_token){res.writeHead(500).end('fail');console.error(td);process.exit(1);}
  const creds={token_type:td.token_type||'Bearer',refresh_token:td.refresh_token,access_token:td.access_token,expiry_date:Date.now()+((td.expires_in||3600)*1000),scope:td.scope||SCOPE,client_id:client.client_id,client_secret:client.client_secret,type:'authorized_user'};
  await writeFile(CREDS,JSON.stringify(creds,null,2));
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<h3>Done. Close tab.</h3>');
  console.log('SUCCESS'); server.close(); process.exit(0);
});
server.listen(port,'127.0.0.1',()=>{console.log(authUrl); exec('start "" "'+authUrl+'"',(e)=>{if(e)console.error('open manually');});});
