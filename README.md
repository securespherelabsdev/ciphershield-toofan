# CipherShield

**Anonymous civic intelligence reporting — built in partnership with Kerala Police, Operation Toofan.**

CipherShield is a zero-knowledge tip-reporting platform. Citizens submit reports about suspected drug-related activity. Their identity — IP address, device fingerprint, precise timestamp, and all metadata — is permanently discarded at the moment the report arrives, before any data is written to disk. Law enforcement receive structured, confidence-scored intelligence leads with zero reporter data attached.

---

## Who built this and why

CipherShield was built by **SecureSphereLabs** to support **Operation Toofan**, an ongoing counter-narcotics initiative. The platform exists because useful intelligence often goes unreported: witnesses fear retaliation, distrust digital systems, or simply cannot find a safe channel. CipherShield eliminates the technical risk of reporting by making identity retention architecturally impossible, not merely policy-prohibited.

The codebase is MIT-licensed and fully open to audit by security researchers, civil society organisations, and the press.

---

## Privacy guarantee

The following guarantees are enforced in code, not in policy. They can be verified by reading the source.

| What we claim | Where it is enforced |
|---|---|
| Your IP address is never recorded | `backend/middleware/anonymize.js` — deleted before any route handler runs |
| Your device/browser information is never recorded | Same middleware — `user-agent`, `accept-language`, and related headers are deleted |
| Your submission timestamp is rounded to a 6-hour block | `anonymize.js:fuzzTimestamp()` — stored fuzzed time only |
| Cookies are never set or read on reporter routes | CSP + `cookie` header deleted in middleware |
| Free-text fields are encrypted before storage | `backend/services/encryption.js` — AES-256-GCM, unique IV per record |
| The status token is never linked to identity | Only the SHA-256 hash of the token is stored; raw token is never persisted |
| No third-party scripts or external requests | CSP: `default-src 'self'` on all pages; landing page works in Tor with JS off |

**Consequence of this architecture:** even if CipherShield servers were seized or subject to a court order, there is no reporter metadata to produce. The data does not exist.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CITIZEN                                                        │
│  Browser / Tor Browser                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS POST /api/submit
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — NGINX                                                │
│  · TLS termination                                              │
│  · access_log off for /api/submit and /api/status              │
│  · X-Forwarded-For header stripped before proxy_pass           │
│  · Static files served directly (landing, submission pages)    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2 — ANONYMIZE MIDDLEWARE (first middleware in Express)   │
│  · Deletes req.ip, req.ips                                      │
│  · Deletes x-forwarded-for, user-agent, referer, cookie,       │
│    accept-language, accept-encoding, and 10 other headers      │
│  · Fuzzes timestamp to nearest 6-hour block                    │
│  · Sets req.sanitized = true                                   │
│  All subsequent middleware verifies req.sanitized === true     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3 — SCORING ENGINE (fpScoring.js)                       │
│  · Rule-based, 0–100, synchronous                              │
│  · Inputs: reporter confidence, specificity, corroboration,    │
│    recency. No PII inputs.                                     │
│  · Outputs: score + status (QUARANTINE / REVIEW / DISPATCH)   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4 — ENCRYPTION + STORAGE                                │
│  · Free-text fields encrypted with AES-256-GCM (unique IV)    │
│  · Token hash (SHA-256 only) stored — raw token given to user │
│  · Zero PII columns in schema — enforced at DB schema level   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 5 — AGENCY PORTAL (authenticated, JWT, memory-only)     │
│  · Officers view confidence-scored leads                       │
│  · AI-generated summary appended at dispatch time (not stored  │
│    until an officer dispatches the lead)                       │
│  · Every officer action written to audit_log (no reporter data)│
│  · Agency visibility rules enforced per role                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Self-hosting guide

### Prerequisites

- Linux VPS (Ubuntu 22.04 LTS or Debian 12 recommended)
- Docker + Docker Compose v2
- Nginx
- Certbot (Let's Encrypt)
- Domain pointed at your server

### 1. Clone and configure

```bash
git clone https://github.com/SecureSphereLabs/ciphershield.git
cd ciphershield
cp .env.example .env
```

Edit `.env`:

```bash
# Generate encryption key
openssl rand -hex 32   # paste as ENCRYPTION_KEY

# Generate JWT secret
openssl rand -hex 64   # paste as JWT_SECRET

# Set your domain
APP_BASE_URL=https://ciphershield.securespherelabs.com

# Set database credentials
DB_USER=ciphershield
DB_PASSWORD=<strong-password>

# Set AI provider credentials (see aiLayer.js)
AI_PROVIDER_KEY=<your-key>
AI_PROVIDER_ENDPOINT=<your-endpoint>
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

This starts MySQL and the Node.js backend. The database schema is applied automatically on first run.

### 3. Nginx setup

```bash
# Install certbot and get a certificate first
certbot certonly --standalone -d ciphershield.securespherelabs.com

# Copy the Nginx config
cp nginx/ciphershield.conf /etc/nginx/sites-available/ciphershield
ln -s /etc/nginx/sites-available/ciphershield /etc/nginx/sites-enabled/

# Copy built frontend assets
mkdir -p /var/www/ciphershield
cp -r landing /var/www/ciphershield/
cp -r submission /var/www/ciphershield/

# Build and copy the agency portal
cd agency-portal && npm ci && npm run build && cd ..
cp -r agency-portal/dist /var/www/ciphershield/portal

nginx -t && systemctl reload nginx
```

### 4. Create first agency user

```bash
# Connect to the database
docker compose exec db mysql -u ciphershield -p ciphershield

# Insert a user (replace values)
INSERT INTO agency_users (id, email, password_hash, agency, created_at)
VALUES (
  UUID(),
  'officer@kerala.police.gov.in',
  '$2b$12$...',   -- generate with: node -e "const b=require('bcrypt');b.hash('password',12).then(console.log)"
  'KERALA_POLICE',
  NOW()
);
```

### 5. Optional: Tor hidden service

```bash
# On Ubuntu/Debian
apt install tor

# Add to /etc/tor/torrc:
HiddenServiceDir /var/lib/tor/ciphershield/
HiddenServicePort 80 127.0.0.1:3000

systemctl restart tor
cat /var/lib/tor/ciphershield/hostname  # your .onion address
```

Update your submission page's form action to point to the .onion address for Tor users, or run both in parallel.

---

## How FP scoring works

Every submitted report receives a false-positive score from 0 to 100. The score is computed synchronously by `backend/services/fpScoring.js` using only the report's own fields and a corroboration count from the database. No AI is involved in scoring.

| Factor | Condition | Points |
|---|---|---|
| **Reporter confidence** | "I have a suspicion" | +10 |
| | "I am fairly certain" | +25 |
| | "I witnessed this directly" | +40 |
| **Specificity** | District provided | +10 |
| | Area description > 50 characters | +10 |
| | Details > 100 characters | +10 |
| **Corroboration** | 2–4 matching reports (same district + type) in last 7 days | +15 |
| | 5+ matching reports in last 7 days | +25 |
| **Recency** | "Today" or "Yesterday" | +5 |
| **Cap** | Maximum score | 100 |

**Dispatch thresholds:**

| Score | Status | Meaning |
|---|---|---|
| 0–39 | QUARANTINE | Not dispatched. Held for potential review. |
| 40–69 | REVIEW | Held for manual officer review before dispatch. |
| 70–100 | DISPATCH | Eligible for agency portal immediately. |

This logic is fully auditable. If you believe the thresholds or weights are poorly calibrated, open an issue or submit a pull request with evidence.

---

## Automated intelligence review

Reports that reach DISPATCH status receive an automated analysis generated by an internal inference service at the time an officer dispatches the lead. This analysis is **never generated at submission time** — it is only created when an officer takes the dispatch action, so that no AI system processes a tip before a human has reviewed its score.

The automated analysis includes:
- A plain-language summary of the lead
- Key indicators extracted from the report text
- A suggested initial investigative step
- A note on information quality

The raw reporter text is always preserved alongside the automated analysis. Officers are expected to treat the automated review as a reading aid, not a decision authority.

The analysis provider is an implementation detail of `backend/services/aiLayer.js`. If the analysis service is unavailable, dispatch proceeds without it — a lead is never blocked because automated analysis failed.

---

## Agency portal access

Access is restricted to authorised officers of Kerala Police, the Excise Department, and CYBERDOME.

To request access: **ciphershield@securespherelabs.com**

**Role visibility:**

| Role | Visible report types |
|---|---|
| KERALA_POLICE | All types |
| EXCISE | Drug Sale Activity, Drug Manufacturing, Drug Transportation |
| CYBERDOME | All types + audit log access |

---

## Security disclosure

If you discover a security vulnerability in CipherShield — especially one that could expose reporter identity — please report it responsibly before public disclosure.

**Security contact:** ciphershield@securespherelabs.com  
**Subject line:** `[SECURITY] CipherShield vulnerability`

Please include:
- A description of the vulnerability
- Steps to reproduce
- Your assessment of the impact on reporter anonymity

We will acknowledge receipt within 48 hours and aim to patch critical issues within 7 days.

---

## Contributing

CipherShield welcomes contributions from:
- Security researchers
- Privacy technologists
- Civil liberties organisations
- Journalists and press freedom advocates
- Open-source developers

Areas most in need of contribution:
- Independent security audit of the anonymize middleware
- Formal verification of the zero-PII database schema
- Tor Browser compatibility testing
- Accessibility audit of the submission form
- Translations of the landing page

Please open an issue before submitting a large pull request.

---

## License

MIT License — see [LICENSE](LICENSE).

CipherShield is free, open-source, and built in the public interest.

---

## Built by SecureSphereLabs

**SecureSphereLabs** builds privacy-preserving civic technology for public institutions and civil society. Supporting Operation Toofan, Kerala Police.
