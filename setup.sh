#!/bin/bash

# IMAP/SMTP Email Skill Setup Helper

echo "================================"
echo "       Email Skill Setup"
echo "================================"
echo ""
echo "This setup will create a .env file with your email credentials."
echo ""

read -p "IMAP Host: " IMAP_HOST
read -p "IMAP Port: " IMAP_PORT
read -p "SMTP Host: " SMTP_HOST
read -p "SMTP Port: " SMTP_PORT
read -p "Use TLS for IMAP? (true/false): " IMAP_TLS
read -p "Use SSL for SMTP? (true/false): " SMTP_SECURE

echo ""
read -p "Email address: " EMAIL
read -s -p "Password / App Password / Authorization Code: " PASSWORD
echo ""
if [ -z "$REJECT_UNAUTHORIZED" ]; then
  read -p "Accept self-signed certificates? (y/n): " ACCEPT_CERT
  if [ "$ACCEPT_CERT" = "y" ]; then
    REJECT_UNAUTHORIZED="false"
  else
    REJECT_UNAUTHORIZED="true"
  fi
fi

read -p "Allow sending email? (y/n): " ALLOW_SEND_INPUT
if [ "$ALLOW_SEND_INPUT" = "y" ]; then
  ALLOW_SEND="true"
else
  ALLOW_SEND="false"
fi

# Create .env file
cat > .env << EOF
# IMAP Configuration
IMAP_HOST=$IMAP_HOST
IMAP_PORT=$IMAP_PORT
IMAP_USER=$EMAIL
IMAP_PASS="$PASSWORD"
IMAP_TLS=$IMAP_TLS
IMAP_REJECT_UNAUTHORIZED=$REJECT_UNAUTHORIZED
IMAP_MAILBOX=INBOX

# SMTP Configuration
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=$SMTP_SECURE
SMTP_USER=$EMAIL
SMTP_PASS="$PASSWORD"
SMTP_FROM=$EMAIL
SMTP_REJECT_UNAUTHORIZED=$REJECT_UNAUTHORIZED
SMTP_ALLOW_SEND=$ALLOW_SEND
EOF

echo ""
echo "✅ Created .env file"
echo ""
echo "Testing connections..."
echo ""

# Test IMAP connection
echo "Testing IMAP..."
if node scripts/imap.js list-mailboxes >/dev/null 2>&1; then
    echo "✅ IMAP connection successful!"
else
    echo "❌ IMAP connection test failed"
    echo "   Please check your credentials and settings"
fi

# Test SMTP connection
echo ""
echo "Testing SMTP..."
if node scripts/smtp.js test >/dev/null 2>&1; then
    echo "✅ SMTP connection successful!"
else
    echo "❌ SMTP connection test failed"
    echo "   Please check your credentials and settings"
fi

echo ""
echo "Setup complete! Try:"
echo "  node scripts/imap.js check"
echo "  node scripts/smtp.js send --to recipient@example.com --subject Test --body 'Hello World'"
