#!/usr/bin/env node

/**
 * IMAP Email CLI
 * Works with any standard IMAP server
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const MailComposer = require('nodemailer/lib/mail-composer');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_MAILBOX = process.env.IMAP_MAILBOX || 'INBOX';

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};
  const positional = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      options[key] = value || true;
      if (value && !value.startsWith('--')) i++;
    } else {
      positional.push(arg);
    }
  }

  return { command, options, positional };
}

// Create IMAP connection config
function createImapConfig() {
  return {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST || '127.0.0.1',
    port: parseInt(process.env.IMAP_PORT) || 1143,
    tls: process.env.IMAP_TLS === 'true',
    tlsOptions: {
      rejectUnauthorized: process.env.IMAP_REJECT_UNAUTHORIZED !== 'false',
    },
    connTimeout: 10000,
    authTimeout: 10000,
  };
}

// Connect to IMAP server with ID support
async function connect() {
  const config = createImapConfig();

  if (!config.user || !config.password) {
    throw new Error('Missing IMAP_USER or IMAP_PASS environment variables');
  }

  return new Promise((resolve, reject) => {
    const imap = new Imap(config);

    imap.once('ready', () => {
      resolve(imap);
    });

    imap.once('error', (err) => {
      reject(new Error(`IMAP connection failed: ${err.message}`));
    });

    imap.connect();
  });
}

// Open mailbox and return promise
function openBox(imap, mailbox, readOnly = false) {
  return new Promise((resolve, reject) => {
    imap.openBox(mailbox, readOnly, (err, box) => {
      if (err) reject(err);
      else resolve(box);
    });
  });
}

// Search for messages
function searchMessages(imap, criteria, fetchOptions) {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      if (!results || results.length === 0) {
        resolve([]);
        return;
      }

      const fetch = imap.fetch(results, fetchOptions);
      const messages = [];

      fetch.on('message', (msg) => {
        const parts = [];

        msg.on('body', (stream, info) => {
          let buffer = '';

          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });

          stream.once('end', () => {
            parts.push({ which: info.which, body: buffer });
          });
        });

        msg.once('attributes', (attrs) => {
          parts.forEach((part) => {
            part.attributes = attrs;
          });
        });

        msg.once('end', () => {
          if (parts.length > 0) {
            messages.push(parts[0]);
          }
        });
      });

      fetch.once('error', (err) => {
        reject(err);
      });

      fetch.once('end', () => {
        resolve(messages);
      });
    });
  });
}

// Fetch a single message by UID, throws if not found
async function fetchByUid(imap, uid) {
  const messages = await searchMessages(imap, [['UID', uid]], { bodies: [''], markSeen: false });
  if (messages.length === 0) {
    throw new Error(`Message UID ${uid} not found`);
  }
  return messages[0];
}

// Parse email from raw buffer
async function parseEmail(bodyStr, includeAttachments = false) {
  const parsed = await simpleParser(bodyStr);

  return {
    from: parsed.from?.text || 'Unknown',
    to: parsed.to?.text,
    subject: parsed.subject || '(no subject)',
    date: parsed.date,
    text: parsed.text,
    html: parsed.html,
    snippet: parsed.text
      ? parsed.text.slice(0, 200)
      : (parsed.html ? parsed.html.slice(0, 200).replace(/<[^>]*>/g, '') : ''),
    attachments: parsed.attachments?.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      content: includeAttachments ? a.content : undefined,
      cid: a.cid,
    })),
  };
}

// Sort messages by date descending, slice to limit, and parse each
async function parseMessages(messages, limit) {
  const sorted = messages.sort((a, b) => {
    const dateA = a.attributes.date ? new Date(a.attributes.date) : new Date(0);
    const dateB = b.attributes.date ? new Date(b.attributes.date) : new Date(0);
    return dateB - dateA;
  }).slice(0, limit);

  const results = [];
  for (const item of sorted) {
    const parsed = await parseEmail(item.body);
    results.push({ uid: item.attributes.uid, ...parsed, flags: item.attributes.flags });
  }
  return results;
}

// Check for new/unread emails
async function checkEmails(mailbox = DEFAULT_MAILBOX, limit = 10, recentTime = null, unreadOnly = false) {
  const imap = await connect();

  try {
    await openBox(imap, mailbox);

    const searchCriteria = unreadOnly ? ['UNSEEN'] : ['ALL'];

    if (recentTime) {
      searchCriteria.push(['SINCE', parseRelativeTime(recentTime)]);
    }

    const messages = await searchMessages(imap, searchCriteria, { bodies: [''], markSeen: false });
    return await parseMessages(messages, limit);
  } finally {
    imap.end();
  }
}

// Fetch full email by UID
async function fetchEmail(uid, mailbox = DEFAULT_MAILBOX) {
  const imap = await connect();

  try {
    await openBox(imap, mailbox);
    const item = await fetchByUid(imap, uid);
    const parsed = await parseEmail(item.body);
    return { uid: item.attributes.uid, ...parsed, flags: item.attributes.flags };
  } finally {
    imap.end();
  }
}

// Download attachments from email
async function downloadAttachments(uid, mailbox = DEFAULT_MAILBOX, outputDir = '.', specificFilename = null) {
  const imap = await connect();

  try {
    await openBox(imap, mailbox);
    const item = await fetchByUid(imap, uid);
    const parsed = await parseEmail(item.body, true);

    if (!parsed.attachments || parsed.attachments.length === 0) {
      return { uid, downloaded: [], message: 'No attachments found' };
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const downloaded = [];

    for (const attachment of parsed.attachments) {
      if (specificFilename && attachment.filename !== specificFilename) {
        continue;
      }
      if (attachment.content) {
        const filePath = path.join(outputDir, attachment.filename);
        fs.writeFileSync(filePath, attachment.content);
        downloaded.push({ filename: attachment.filename, path: filePath, size: attachment.size });
      }
    }

    if (specificFilename && downloaded.length === 0) {
      const availableFiles = parsed.attachments.map(a => a.filename).join(', ');
      return { uid, downloaded: [], message: `File "${specificFilename}" not found. Available attachments: ${availableFiles}` };
    }

    return { uid, downloaded, message: `Downloaded ${downloaded.length} attachment(s)` };
  } finally {
    imap.end();
  }
}

// Parse relative time (e.g., "2h", "30m", "7d") to Date
function parseRelativeTime(timeStr) {
  const match = timeStr.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    throw new Error('Invalid time format. Use: 30m, 2h, 7d');
  }

  const value = parseInt(match[1]);
  const unit = match[2];
  const now = new Date();

  switch (unit) {
    case 'm': return new Date(now.getTime() - value * 60 * 1000);
    case 'h': return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd': return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    default: throw new Error('Unknown time unit');
  }
}

// Search emails with criteria
async function searchEmails(options) {
  const imap = await connect();

  try {
    await openBox(imap, options.mailbox || DEFAULT_MAILBOX);

    const criteria = [];

    if (options.unseen) criteria.push('UNSEEN');
    if (options.seen) criteria.push('SEEN');
    if (options.from) criteria.push(['FROM', options.from]);
    if (options.subject) criteria.push(['SUBJECT', options.subject]);

    if (options.recent) {
      criteria.push(['SINCE', parseRelativeTime(options.recent)]);
    } else {
      if (options.since) criteria.push(['SINCE', options.since]);
      if (options.before) criteria.push(['BEFORE', options.before]);
    }

    if (criteria.length === 0) criteria.push('ALL');

    const messages = await searchMessages(imap, criteria, { bodies: [''], markSeen: false });
    return await parseMessages(messages, parseInt(options.limit) || 20);
  } finally {
    imap.end();
  }
}

// Mark message(s) as read
async function markAsRead(uids, mailbox = DEFAULT_MAILBOX) {
  const imap = await connect();

  try {
    await openBox(imap, mailbox);
    await new Promise((resolve, reject) => {
      imap.addFlags(uids, '\\Seen', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return { success: true, uids, action: 'marked as read' };
  } finally {
    imap.end();
  }
}

// Mark message(s) as unread
async function markAsUnread(uids, mailbox = DEFAULT_MAILBOX) {
  const imap = await connect();

  try {
    await openBox(imap, mailbox);
    await new Promise((resolve, reject) => {
      imap.delFlags(uids, '\\Seen', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return { success: true, uids, action: 'marked as unread' };
  } finally {
    imap.end();
  }
}

// Move message(s) to another mailbox
async function moveEmails(uids, destMailbox, srcMailbox = DEFAULT_MAILBOX) {
  const imap = await connect();

  try {
    await openBox(imap, srcMailbox, false); // read-write required for move
    const moveFn = imap.uid ? imap.uid.move.bind(imap.uid) : imap.move.bind(imap);
    await new Promise((resolve, reject) => {
      moveFn(uids, destMailbox, (err) => {
        if (err) reject(new Error(`Move failed: ${err.message}`));
        else resolve();
      });
    });
    return { success: true, uids, from: srcMailbox, to: destMailbox, action: 'moved' };
  } finally {
    imap.end();
  }
}

// Save a draft to the Drafts mailbox
async function saveDraft(draftOptions, draftsMailbox = 'Drafts') {
  const imap = await connect();

  try {
    const composer = new MailComposer({
      from: draftOptions.from || process.env.IMAP_USER,
      to: draftOptions.to,
      cc: draftOptions.cc,
      bcc: draftOptions.bcc,
      subject: draftOptions.subject || '(no subject)',
      text: draftOptions.isHtml ? undefined : draftOptions.body,
      html: draftOptions.isHtml ? draftOptions.body : undefined,
    });

    const message = await new Promise((resolve, reject) => {
      composer.compile().build((err, buf) => {
        if (err) reject(err);
        else resolve(buf);
      });
    });

    await new Promise((resolve, reject) => {
      imap.append(message, { mailbox: draftsMailbox, flags: ['\\Draft', '\\Seen'], date: new Date() }, (err) => {
        if (err) reject(new Error(`Failed to save draft: ${err.message}`));
        else resolve();
      });
    });

    return {
      success: true,
      mailbox: draftsMailbox,
      subject: draftOptions.subject || '(no subject)',
      to: draftOptions.to,
      action: 'draft saved',
    };
  } finally {
    imap.end();
  }
}

// List all mailboxes
async function listMailboxes() {
  const imap = await connect();

  try {
    const boxes = await new Promise((resolve, reject) => {
      imap.getBoxes((err, boxes) => {
        if (err) reject(err);
        else resolve(boxes);
      });
    });
    return formatMailboxTree(boxes);
  } finally {
    imap.end();
  }
}

// Format mailbox tree recursively
function formatMailboxTree(boxes, prefix = '') {
  const result = [];
  for (const [name, info] of Object.entries(boxes)) {
    const fullName = prefix ? `${prefix}${info.delimiter}${name}` : name;
    result.push({
      name: fullName,
      delimiter: info.delimiter,
      attributes: info.attribs,
    });

    if (info.children) {
      result.push(...formatMailboxTree(info.children, fullName));
    }
  }
  return result;
}

// Main CLI handler
async function main() {
  const { command, options, positional } = parseArgs();

  try {
    let result;

    switch (command) {
      case 'check':
        result = await checkEmails(
          options.mailbox || DEFAULT_MAILBOX,
          parseInt(options.limit) || 10,
          options.recent || null,
          !!options.unseen
        );
        break;

      case 'fetch':
        if (!positional[0]) {
          throw new Error('UID required: node imap.js fetch <uid>');
        }
        result = await fetchEmail(positional[0], options.mailbox);
        break;

      case 'download':
        if (!positional[0]) {
          throw new Error('UID required: node imap.js download <uid>');
        }
        result = await downloadAttachments(positional[0], options.mailbox, options.dir || '.', options.file || null);
        break;

      case 'search':
        result = await searchEmails(options);
        break;

      case 'mark-read':
        if (positional.length === 0) {
          throw new Error('UID(s) required: node imap.js mark-read <uid> [uid2...]');
        }
        result = await markAsRead(positional, options.mailbox);
        break;

      case 'mark-unread':
        if (positional.length === 0) {
          throw new Error('UID(s) required: node imap.js mark-unread <uid> [uid2...]');
        }
        result = await markAsUnread(positional, options.mailbox);
        break;

      case 'move':
        if (positional.length === 0) {
          throw new Error('UID(s) required: node imap.js move <uid> [uid2...] --to <mailbox>');
        }
        if (!options.to) {
          throw new Error('Destination required: node imap.js move <uid> --to <mailbox>');
        }
        result = await moveEmails(positional, options.to, options.from || DEFAULT_MAILBOX);
        break;

      case 'draft': {
        if (!options.subject && !options['subject-file']) {
          throw new Error('Subject required: node imap.js draft --subject <text>');
        }
        if (options['subject-file']) {
          options.subject = fs.readFileSync(options['subject-file'], 'utf8').trim();
        }
        let draftBody, draftIsHtml;
        if (options['body-file']) {
          const content = fs.readFileSync(options['body-file'], 'utf8');
          draftIsHtml = options['body-file'].endsWith('.html') || !!options.html;
          draftBody = content;
        } else if (options['html-file']) {
          draftBody = fs.readFileSync(options['html-file'], 'utf8');
          draftIsHtml = true;
        } else {
          draftBody = options.body;
          draftIsHtml = !!options.html;
        }
        result = await saveDraft({
          from: options.from,
          to: options.to,
          cc: options.cc,
          bcc: options.bcc,
          subject: options.subject,
          body: draftBody,
          isHtml: draftIsHtml,
        }, options.mailbox || 'Drafts');
        break;
      }

      case 'list-mailboxes':
        result = await listMailboxes();
        break;

      default:
        console.error('Unknown command:', command);
        console.error('Available commands: check, fetch, download, search, mark-read, mark-unread, move, draft, list-mailboxes');
        process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
