#!/bin/bash
# ── Auto-provision secrets on first run ────────────────────────────────────────
# If KEY_VAULT_SECRET is not set, generate one and persist it to the shared
# secrets volume so it survives container restarts and recreates.
#
# Enterprise pattern: init-container style secret provisioning for docker-compose.
# ────────────────────────────────────────────────────────────────────────────────

set -e

SECRETS_DIR="${SECRETS_DIR:-/secrets}"
SECRET_FILE="${SECRETS_DIR}/key_vault_secret"

# ── KEY_VAULT_SECRET ───────────────────────────────────────────────────────────
if [ -z "${KEY_VAULT_SECRET}" ]; then
  if [ -f "${SECRET_FILE}" ]; then
    KEY_VAULT_SECRET=$(cat "${SECRET_FILE}")
    export KEY_VAULT_SECRET
    echo "[entrypoint] Loaded KEY_VAULT_SECRET from ${SECRET_FILE}"
  else
    KEY_VAULT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    export KEY_VAULT_SECRET
    mkdir -p "${SECRETS_DIR}"
    echo -n "${KEY_VAULT_SECRET}" > "${SECRET_FILE}"
    echo "[entrypoint] Generated new KEY_VAULT_SECRET → ${SECRET_FILE}"
  fi
fi

# ── Launch the application ─────────────────────────────────────────────────────
exec "$@"
