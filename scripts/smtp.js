#!/usr/bin/env node

/**
 * SMTP Email CLI
 * Send email via SMTP protocol. Works with any standard SMTP server.
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

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

// Create SMTP transporter
function createTransporter() {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
    },
  };

  if (!config.host || !config.auth.user || !config.auth.pass) {
    throw new Error('Missing SMTP configuration. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env');
  }

  return nodemailer.createTransport(config);
}

// Send email
async function sendEmail(options) {
  const transporter = createTransporter();

  try {
    await transporter.verify();
  } catch (err) {
    throw new Error(`SMTP connection failed: ${err.message}`);
  }

  const info = await transporter.sendMail({
    from: options.from || process.env.SMTP_FROM || process.env.SMTP_USER,
    to: options.to,
    cc: options.cc || undefined,
    bcc: options.bcc || undefined,
    subject: options.subject || '(no subject)',
    text: options.text || undefined,
    html: options.html || undefined,
    attachments: options.attachments || [],
  });

  return {
    success: true,
    messageId: info.messageId,
    response: info.response,
    to: options.to,
  };
}

// Test SMTP connection
async function testConnection() {
  const transporter = createTransporter();

  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'SMTP Connection Test',
      text: 'This is a test email from the IMAP/SMTP email skill.',
    });

    return {
      success: true,
      message: 'SMTP connection successful',
      messageId: info.messageId,
    };
  } catch (err) {
    throw new Error(`SMTP test failed: ${err.message}`);
  }
}

// Main CLI handler
async function main() {
  const { command, options } = parseArgs();

  try {
    let result;

    switch (command) {
      case 'send':
        if (process.env.SMTP_ALLOW_SEND !== 'true') {
          throw new Error('Sending is disabled. Set SMTP_ALLOW_SEND=true in .env to enable.');
        }
        if (!options.to) {
          throw new Error('Missing required option: --to <email>');
        }
        if (!options.subject && !options['subject-file']) {
          throw new Error('Missing required option: --subject <text> or --subject-file <file>');
        }

        if (options['subject-file']) {
          options.subject = fs.readFileSync(options['subject-file'], 'utf8').trim();
        }

        if (options['body-file']) {
          const content = fs.readFileSync(options['body-file'], 'utf8');
          if (options['body-file'].endsWith('.html') || options.html) {
            options.html = content;
          } else {
            options.text = content;
          }
        } else if (options['html-file']) {
          options.html = fs.readFileSync(options['html-file'], 'utf8');
        } else if (options.body) {
          options.text = options.body;
        }

        if (options.attach) {
          options.attachments = options.attach.split(',').map((f) => {
            f = f.trim();
            if (!fs.existsSync(f)) throw new Error(`Attachment file not found: ${f}`);
            return { filename: path.basename(f), path: path.resolve(f) };
          });
        }

        result = await sendEmail(options);
        break;

      case 'test':
        result = await testConnection();
        break;

      default:
        console.error('Unknown command:', command);
        console.error('Available commands: send, test');
        process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
