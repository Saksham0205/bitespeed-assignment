# Bitespeed Identity Reconciliation API

A Node.js/TypeScript web service that identifies and links customer contacts across multiple purchases using email and phone number. Built for the Bitespeed Backend Task.

## Features

- **Identity Reconciliation**: Links different orders made with different contact information to the same person
- **Contact Linking**: Contacts are linked when they share email OR phone number
- **Primary/Secondary**: Oldest contact is "primary", linked contacts are "secondary"
- **Chain Merging**: When two separate primary contacts get linked (e.g., shared email + shared phone), the newer one becomes secondary

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL (via Prisma)

## Live API

**Base URL:** `https://bitespeed-identity-reconciliation-api-vdxn.onrender.com`

```bash
# Example: Create contact
curl -X POST https://bitespeed-identity-reconciliation-api-vdxn.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"lorraine@hillvalley.edu","phoneNumber":"123456"}'
```

## Setup (Local Development)

1. Get a free PostgreSQL database at [Neon](https://neon.tech) or run PostgreSQL locally.
2. Copy `.env.example` to `.env` and set your `DATABASE_URL`.
3. Run:

```bash
npm install
npm run db:generate
npm run db:push    # or: npm run db:migrate
npm run dev
```

The server runs on `http://localhost:3000` by default. Set `PORT` env var to override.

## API

### POST /identify

Identifies a contact and returns consolidated contact information. Creates new contacts or links existing ones as needed.

**Request** (JSON body):

```json
{
  "email": "string (optional)",
  "phoneNumber": "string or number (optional)"
}
```

At least one of `email` or `phoneNumber` is required.

**Response** (200 OK):

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

- `primaryContatctId`: ID of the primary contact (oldest in the chain)
- `emails`: All unique emails (primary's email first)
- `phoneNumbers`: All unique phone numbers (primary's phone first)
- `secondaryContactIds`: IDs of all secondary contacts

### GET /health

Health check endpoint.

## Example Usage

```bash
# Create new contact (first order)
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"lorraine@hillvalley.edu","phoneNumber":"123456"}'

# Same customer, different email (creates secondary)
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"mcfly@hillvalley.edu","phoneNumber":"123456"}'

# Query by phone only
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"123456"}'

# Query by email only
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"mcfly@hillvalley.edu"}'
```

All of the above (after the second request) return the same consolidated contact.

## Database Schema

```prisma
model Contact {
  id             Int       @id @default(autoincrement())
  phoneNumber    String?
  email          String?
  linkedId       Int?      // ID of primary contact this links to
  linkPrecedence String    // "primary" | "secondary"
  createdAt      DateTime
  updatedAt      DateTime
  deletedAt      DateTime?
}
```

## License

MIT
