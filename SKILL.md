---
name: imap-smtp-email
description: Read and send email via IMAP/SMTP. Check for new/unread messages, fetch content, search mailboxes, mark as read/unread, move messages between folders, save drafts, and send emails with attachments. Works with any IMAP/SMTP server.
---

## IMAP Commands

### check

```bash
node scripts/imap.js check [--limit 10] [--mailbox INBOX] [--recent 2h]
```

Options:
- `--limit <n>`: Max results (default: 10)
- `--mailbox <name>`: Mailbox to check (default: INBOX)
- `--recent <time>`: Only show emails from last X time (e.g., 30m, 2h, 7d)

### fetch

```bash
node scripts/imap.js fetch <uid> [--mailbox INBOX]
```

### download

```bash
node scripts/imap.js download <uid> [--mailbox INBOX] [--dir <path>] [--file <filename>]
```

Options:
- `--dir <path>`: Output directory (default: current directory)
- `--file <filename>`: Download only the specified attachment (default: all)

### search

```bash
node scripts/imap.js search [options]
```

Options:
- `--unseen` / `--seen`: Filter by read status
- `--from <email>`: From address contains
- `--subject <text>`: Subject contains
- `--recent <time>`: From last X time (e.g., 30m, 2h, 7d)
- `--since <date>` / `--before <date>`: Date range (YYYY-MM-DD)
- `--limit <n>`: Max results (default: 20)
- `--mailbox <name>`: Mailbox to search (default: INBOX)

### mark-read / mark-unread

```bash
node scripts/imap.js mark-read <uid> [uid2 uid3...]
node scripts/imap.js mark-unread <uid> [uid2 uid3...]
```

### add-flag / remove-flag

```bash
node scripts/imap.js add-flag <uid> [uid2 uid3...] --flag <name> [--mailbox INBOX]
node scripts/imap.js remove-flag <uid> [uid2 uid3...] --flag <name> [--mailbox INBOX]
```

Options:
- `--flag <name>`: Flag to add or remove (**required**). Accepts friendly names: `seen`, `flagged`, `answered`, `deleted`, `draft`. Custom/keyword flags (e.g., `$Junk`) are also supported.
- `--mailbox <name>`: Mailbox (default: INBOX)

### get-flags

```bash
node scripts/imap.js get-flags <uid> [uid2 uid3...] [--mailbox INBOX]
```

### move

```bash
node scripts/imap.js move <uid> [uid2...] --to <mailbox> [--from <mailbox>]
```

Options:
- `--to <mailbox>`: Destination mailbox (**required**)
- `--from <mailbox>`: Source mailbox (default: INBOX)

### draft

```bash
node scripts/imap.js draft --subject <text> [--to <email>] [--body <text>] [--html] [--from <email>] [--cc <email>] [--bcc <email>] [--mailbox Drafts]
```

Options:
- `--subject <text>`: Email subject (**required**), or `--subject-file <file>`
- `--to <email>`: Recipient (optional)
- `--body <text>`: Plain text body, or `--body-file <file>`
- `--html`: Treat body as HTML, or `--html-file <file>`
- `--from <email>`: Sender (default: `IMAP_USER`)
- `--cc <email>`: CC recipients
- `--bcc <email>`: BCC recipients
- `--mailbox <name>`: Drafts folder name (default: `Drafts`)

### list-mailboxes

```bash
node scripts/imap.js list-mailboxes
```

## SMTP Commands

### send

```bash
node scripts/smtp.js send --to <email> --subject <text> [options]
```

Options:
- `--to <email>`: Recipient (**required**, comma-separated for multiple)
- `--subject <text>`: Email subject (**required**), or `--subject-file <file>`
- `--body <text>`: Plain text body, or `--body-file <file>`
- `--html`: Send body as HTML, or `--html-file <file>`
- `--cc <email>`: CC recipients
- `--bcc <email>`: BCC recipients
- `--attach <file>`: Attachments (comma-separated)
- `--from <email>`: Override default sender

Examples:
```bash
node scripts/smtp.js send --to recipient@example.com --subject "Hello" --body "World"
node scripts/smtp.js send --to recipient@example.com --subject "Newsletter" --html --body "<h1>Welcome</h1>"
node scripts/smtp.js send --to recipient@example.com --subject "Report" --body "See attached" --attach report.pdf
node scripts/smtp.js send --to "a@example.com,b@example.com" --cc "c@example.com" --subject "Update" --body "Team update"
```

### test

```bash
node scripts/smtp.js test
```
