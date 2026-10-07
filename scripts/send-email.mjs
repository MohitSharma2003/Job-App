import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

const [draftPath] = process.argv.slice(2);
if (!draftPath) {
  console.error('Usage: node send-email.mjs <draft.txt>');
  process.exit(1);
}

const rootDir = process.cwd();
const CREDS = join(homedir(), '.gmail-mcp', 'credentials.json');
const KEYS = join(homedir(), '.gmail-mcp', 'gcp-oauth.keys.json');
const RESUME_DIR = join(rootDir, 'resume');
const RESUME_DEFAULT = join(RESUME_DIR, 'YOUR_RESUME.pdf');
const FROM_EMAIL = process.env.JOB_APP_EMAIL || 'YOUR_EMAIL@gmail.com';
const FROM_NAME = process.env.JOB_APP_NAME || 'Your Name';
