# ADR 004: Fernet Encryption for API Key Vault

**Status**: Accepted

## Context

AgentStudio stores third-party API keys (OpenAI, DeepSeek, MCP providers) so users don't need to re-enter them per session. These keys must be encrypted at rest in the PostgreSQL database. We evaluated cloud KMS (Alibaba Cloud KMS, AWS KMS), hardware security modules, and application-level encryption with Fernet.

## Decision

We chose **Fernet symmetric encryption** (AES-128-CBC with HMAC-SHA256 authentication) with a PBKDF2-derived key. The encryption secret (`KEY_VAULT_SECRET`, minimum 32 bytes) is supplied via environment variable and never stored in the database. Encryption/decryption happens entirely within the application layer (`backend/repository/keys.py`).

Key reasons:
- **Deployment simplicity**: No cloud provider dependency — the same encryption works identically in local Docker, on-premise, and any cloud. A single env var is the only configuration surface.
- **Strong guarantees**: Fernet provides authenticated encryption. Any ciphertext tampering (even a single bit flip) is detected via HMAC verification. Timestamp binding prevents replay of old ciphertexts.
- **Standard library**: Fernet is part of the `cryptography` library (already a dependency via FastAPI/SQLAlchemy), avoiding new supply-chain risk.
- **Sufficient threat model**: Our primary threat is an attacker reading the database directly (SQL injection, backup exfiltration). Fernet ensures raw ciphertext is opaque. We are not defending against an attacker with access to the application server's memory (in which case KMS wouldn't help either).

Cloud KMS was rejected because it introduces provider lock-in, network dependency for every en/decrypt operation, and per-key access control complexity disproportionate to our needs. Simpler AES without authentication (e.g., AES-CTR) was rejected because it doesn't detect tampering — a malicious ciphertext could be injected without raising alarms.

## Consequences

- Key rotation requires re-encrypting all stored keys with the new secret — a batch migration must be run.
- If `KEY_VAULT_SECRET` is lost, all stored API keys are irrecoverable. Backup of this secret is critical.
- No hardware-based key isolation — compromised application memory can expose decrypted keys.
