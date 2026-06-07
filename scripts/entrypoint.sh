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
    KEY_VAULT_SECRET=$(cat "${SECRET_FILE}" 2>/dev/null || echo "")
    if [ -n "${KEY_VAULT_SECRET}" ]; then
      export KEY_VAULT_SECRET
      echo "[entrypoint] Loaded KEY_VAULT_SECRET from ${SECRET_FILE}"
    fi
  fi

  if [ -z "${KEY_VAULT_SECRET}" ]; then
    KEY_VAULT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    export KEY_VAULT_SECRET
    mkdir -p "${SECRETS_DIR}" 2>/dev/null || true
    if echo -n "${KEY_VAULT_SECRET}" > "${SECRET_FILE}" 2>/dev/null; then
      echo "[entrypoint] Generated new KEY_VAULT_SECRET → ${SECRET_FILE}"
    else
      echo "[entrypoint] KEY_VAULT_SECRET in memory only (cannot write ${SECRET_FILE})"
    fi
  fi
fi

# ── Launch the application ─────────────────────────────────────────────────────
exec "$@"
