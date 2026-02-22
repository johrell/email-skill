# Email Skill

Read and send email via IMAP/SMTP. Works with any standard IMAP/SMTP server (Gmail, Outlook, Fastmail, ProtonMail Bridge, self-hosted, etc).

**Capabilities:** Check inbox, fetch messages, search, download attachments, mark read/unread, set/remove flags, move between folders, save drafts, send emails with attachments.

## Install

```bash
git clone <repo-url>
cd email-skill
npm install
bash setup.sh
```

`setup.sh` will prompt for your server details and credentials, create a `.env` file, and test both IMAP and SMTP connections.

## Use as a Skill

This project is designed to be used as a skill by AI coding tools. Add it to your tool's skill directory:

**Claude Code**

```bash
claude mcp add-skill /path/to/email-skill
```

**OpenClaw**

Clone or copy the skill folder into one of OpenClaw's skill directories:

```bash
# Workspace-level (highest priority)
cp -r /path/to/email-skill <workspace>/skills/email-skill

# Or user-level (shared across agents)
cp -r /path/to/email-skill ~/.openclaw/skills/email-skill
```

You can also add a custom path via `skills.load.extraDirs` in `~/.openclaw/openclaw.json`.

**Other tools**

Any tool that supports the AgentSkills format can use this. Point it at the skill directory and it will pick up `SKILL.md` for command reference.

Once installed, ask your AI tool to check email, send a message, search your inbox, etc. The AI reads `SKILL.md` to know which commands are available.

## Manual Usage

All commands output JSON and can be used standalone from the terminal.

### Reading Email (IMAP)

```bash
# Check recent emails
node scripts/imap.js check
node scripts/imap.js check --limit 5 --recent 2h

# Fetch a specific email by UID
node scripts/imap.js fetch 1234

# Search with filters
node scripts/imap.js search --from boss@example.com --unseen --recent 7d
node scripts/imap.js search --subject "invoice" --since 2025-01-01

# Download attachments
node scripts/imap.js download 1234
node scripts/imap.js download 1234 --file report.pdf --dir ~/Downloads

# Manage messages
node scripts/imap.js mark-read 1234 1235
node scripts/imap.js mark-unread 1234
node scripts/imap.js add-flag 1234 --flag flagged
node scripts/imap.js remove-flag 1234 --flag flagged
node scripts/imap.js get-flags 1234
node scripts/imap.js move 1234 --to Archive

# Save a draft
node scripts/imap.js draft --to someone@example.com --subject "Hello" --body "Draft content"

# List all mailboxes/folders
node scripts/imap.js list-mailboxes
```

### Sending Email (SMTP)

Sending is disabled by default. Set `SMTP_ALLOW_SEND=true` in `.env` to enable.

```bash
# Send a plain text email
node scripts/smtp.js send --to recipient@example.com --subject "Hello" --body "World"

# Send HTML
node scripts/smtp.js send --to recipient@example.com --subject "Update" --html --body "<h1>News</h1>"

# Send with attachments
node scripts/smtp.js send --to recipient@example.com --subject "Report" --body "See attached" --attach report.pdf

# Multiple recipients
node scripts/smtp.js send --to "a@example.com,b@example.com" --cc "c@example.com" --subject "Team update" --body "Hi all"

# Test SMTP connection
node scripts/smtp.js test
```

## Configuration

Run `bash setup.sh` for interactive setup, or create a `.env` file manually:

```bash
# IMAP
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your@email.com
IMAP_PASS=your_app_password
IMAP_TLS=true
IMAP_REJECT_UNAUTHORIZED=true
IMAP_MAILBOX=INBOX

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@email.com
SMTP_PASS=your_app_password
SMTP_FROM=your@email.com
SMTP_REJECT_UNAUTHORIZED=true
SMTP_ALLOW_SEND=false
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) rather than your account password.

## License

MIT
