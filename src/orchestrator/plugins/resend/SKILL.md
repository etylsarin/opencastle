---
name: resend-email
description: "Resend transactional email patterns, React Email templates, domain configuration, and webhook handling. Use when sending emails, building email templates, or configuring email delivery."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Resend Email

Resend-specific email sending patterns and React Email template conventions.

## Setup

```bash
npm install resend
npm install @react-email/components  # For React Email templates
```

### Client Initialization

```typescript
// lib/resend.ts
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required');
}

export const resend = new Resend(process.env.RESEND_API_KEY);
```

## Sending Emails

### Basic Send

```typescript
import { resend } from '@/lib/resend';

await resend.emails.send({
  from: 'App <no-reply@yourdomain.com>',
  to: ['user@example.com'],
  subject: 'Welcome to our app',
  html: '<p>Welcome! Your account is ready.</p>',
});
```

### With React Email Template

```typescript
import { resend } from '@/lib/resend';
import { WelcomeEmail } from '@/emails/welcome';

await resend.emails.send({
  from: 'App <no-reply@yourdomain.com>',
  to: ['user@example.com'],
  subject: 'Welcome to our app',
  react: WelcomeEmail({ name: 'Alice' }),
});
```

## React Email Templates

### Template Structure

```
emails/
├── welcome.tsx
├── password-reset.tsx
├── invoice.tsx
└── components/
    ├── header.tsx
    ├── footer.tsx
    └── button.tsx
```

### Template Pattern

```tsx
// emails/welcome.tsx
import {
  Html, Head, Body, Container, Section,
  Heading, Text, Button, Img, Hr,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
  loginUrl?: string;
}

export function WelcomeEmail({
  name,
  loginUrl = 'https://app.example.com/login',
}: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Welcome, {name}!</Heading>
          <Text style={textStyle}>
            Your account has been created successfully.
          </Text>
          <Section style={{ textAlign: 'center' as const }}>
            <Button href={loginUrl} style={buttonStyle}>
              Get Started
            </Button>
          </Section>
          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            © 2026 Your App. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const containerStyle = { margin: '0 auto', padding: '40px 20px', maxWidth: '580px' };
const headingStyle = { fontSize: '24px', color: '#1a1a1a' };
const textStyle = { fontSize: '16px', color: '#4a4a4a', lineHeight: '26px' };
const buttonStyle = {
  backgroundColor: '#3b82f6', color: '#fff', fontSize: '16px',
  padding: '12px 24px', borderRadius: '6px', textDecoration: 'none',
};
const hrStyle = { borderColor: '#e6e6e6', margin: '32px 0' };
const footerStyle = { fontSize: '12px', color: '#999' };

export default WelcomeEmail;
```

### Preview Templates

```bash
npx email dev  # Start React Email dev server at localhost:3000
```

## Domain Configuration

1. Add your domain at resend.com → Domains
2. Configure DNS records (SPF, DKIM, DMARC) as instructed
3. Wait for domain verification (usually < 1 hour)
4. Use `from: 'Name <no-reply@yourdomain.com>'` in sends

## Webhook Handling

```typescript
// app/api/webhooks/resend/route.ts
import { Webhook } from 'resend';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('svix-signature');

  const webhook = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);
  const event = webhook.verify(body, {
    'svix-id': request.headers.get('svix-id')!,
    'svix-timestamp': request.headers.get('svix-timestamp')!,
    'svix-signature': signature!,
  });

  switch (event.type) {
    case 'email.delivered':
      // Handle successful delivery
      break;
    case 'email.bounced':
      // Handle bounce — remove from mailing list
      break;
    case 'email.complained':
      // Handle spam complaint — unsubscribe immediately
      break;
  }

  return new Response('OK', { status: 200 });
}
```

## Best Practices

- Always use a verified custom domain — never send from `onboarding@resend.dev` in production
- Use React Email templates for complex emails — plain HTML for simple transactional messages
- Handle bounces and complaints via webhooks — remove invalid addresses promptly
- Use `RESEND_API_KEY` as an environment variable — never commit it
- Test emails locally with React Email dev server before deploying
- Set appropriate `from` addresses: `no-reply@` for transactional, named sender for marketing
- Include unsubscribe links where legally required (CAN-SPAM, GDPR)
- Keep email templates responsive — test in major email clients
