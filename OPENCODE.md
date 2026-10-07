# Opencode Instructions

This repo is an email automation template for job applications using Gmail API.

## What this does
- Create/reuse drafts in drafts/
- Send via scripts/send-email.mjs
- Log in logs/ and archive to sent/
- Follow email-style-rules.md strictly

## Usage with opencode
- Clone this repo
- Follow SETUP-GUIDE.md
- Add resume to resume/
- Use opencode to draft emails following rules, then send one at a time with spacing

## Rules to enforce
- Never commit secrets (credentials.json, tokens)
- Only send to emails found literally with source URL
- 180-220 words, no dashes, no AI phrases, per rules
