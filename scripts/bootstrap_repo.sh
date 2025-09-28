#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# GateBook Enterprise — Bootstrap (Unix)
# Install → Prisma migrate dev → Start api/web (pnpm workspace)
#
# Usage:
#   chmod +x scripts/bootstrap_repo.sh
#   ./scripts/bootstrap_repo.sh
#
# Notes:
#   - Erwartet Node.js 22 LTS (".nvmrc" = v22).
#   - Spiegelung zur PowerShell-Variante (WO-OPS-3).
#   - Akzeptanzkriterien (WO-OPS-4):
#       • set -e
#       • pnpm i
#       • pnpm -w prisma:migrate
#       • pnpm -w dev
# -----------------------------------------------------------------------------

set -euo pipefail
IFS=$'\n\t'

# --- Helpers ------------------------------------------------------------------
log() { printf '\n=== %s ===\n' "$*"; }
run() { printf '→ %s\n' "$*"; eval "$@"; }

find_repo_root() {
  local start="$1"
  local cur
  cur="$(cd "$start" && pwd -P)"
  while :; do
    for a in pnpm-workspace.yaml turbo.json package.json .git; do
      if [ -e "$cur/$a" ]; then
        printf '%s' "$cur"
        return 0
      fi
    done
    local parent
    parent="$(dirname "$cur")"
    if [ "$parent" = "$cur" ] || [ -z "$parent" ]; then
      break
    fi
    cur="$parent"
  done
  # Fallback: /scripts → ..
  if [ "$(basename "$start")" = "scripts" ]; then
    printf '%s' "$(cd "$start/.." && pwd -P)"
    return 0
  fi
  return 1
}

approve_prisma_builds() {
  # pnpm v10+: Build-Skripte für Prisma-Pakete vorab erlauben (non-interaktiv)
  pnpm -C "$REPO_ROOT" approve-builds prisma @prisma/client @prisma/engines >/dev/null 2>&1 || true
}

# --- Script/Repo Pfade --------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(find_repo_root "$SCRIPT_DIR" 2>/dev/null || true)"
[ -z "${REPO_ROOT:-}" ] && { echo "ERROR: Repo-Root nicht gefunden."; exit 1; }
printf 'ScriptDir erkannt: %s\n' "$SCRIPT_DIR"
printf 'RepoRoot erkannt:  %s\n' "$REPO_ROOT"

cd "$REPO_ROOT"

# --- Preflight: Node.js 22 ----------------------------------------------------
log "Preflight: Node.js 22 LTS prüfen (.nvmrc=v22)"
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js nicht im PATH." >&2; exit 1
fi
NODE_V="$(node -v || true)"
[ -z "$NODE_V" ] && { echo "ERROR: Node-Version unbekannt." >&2; exit 1; }
case "$NODE_V" in
  v22.*) : ;;
  *) echo "ERROR: Erforderlich v22.x — Gefunden: $NODE_V" >&2; exit 1 ;;
esac

# --- Corepack/PNPM ------------------------------------------------------------
log "Corepack/PNPM aktivieren"
if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
  command -v corepack >/dev/null 2>&1 && corepack prepare pnpm@latest --activate || {
    echo "ERROR: pnpm nicht verfügbar." >&2; exit 1;
  }
fi
printf 'pnpm Version: %s\n' "$(pnpm --version)"

# --- (optional) Prisma-Builds freigeben ---------------------------------------
approve_prisma_builds || true

# --- Acceptance 1: Install ----------------------------------------------------
log "Install: pnpm i (Workspace/Root)"
run pnpm -C "$REPO_ROOT" i

# --- Acceptance 2: Prisma migrate (Workspace-Script) --------------------------
log "Prisma: pnpm -w prisma:migrate"
# Falls kein entsprechendes Script vorhanden ist, versuchen wir einen Fallback – ohne das Setzen
# der Akzeptanz zu verletzen (der Aufruf erfolgt trotzdem zuerst).
if ! pnpm -C "$REPO_ROOT" -w prisma:migrate; then
  echo "WARN: 'pnpm -w prisma:migrate' fehlgeschlagen – versuche Fallback (services/api → prisma migrate dev)…"
  if [ -d "$REPO_ROOT/services/api" ]; then
    run pnpm -C "$REPO_ROOT" -w --filter ./services/api exec prisma migrate dev
  else
    echo "WARN: services/api nicht vorhanden – Migration übersprungen."
  fi
fi

# --- Acceptance 3: Start Dev (Workspace) --------------------------------------
log "Start: pnpm -w dev"
run pnpm -C "$REPO_ROOT" -w dev

# -----------------------------------------------------------------------------
# [Referenzblock – Kap. 17.4]
# Datum: 2025-09-17
# Work Order: WO-OPS-4 — "bootstrap_repo.sh" · Deliverable: scripts/bootstrap_repo.sh
# SSOT-Bezug:
#   - Stack & DB Baseline W1 (Node 22 LTS, PNPM Workspaces, Prisma 6, Fastify 5)
#   - E2E W1: Register → Verify → Login → SSR /dashboard
# Akzeptanzkriterien – Erfüllung:
#   - set -e (→ set -euo pipefail)
#   - pnpm i (→ pnpm -C "$REPO_ROOT" i)
#   - pnpm -w prisma:migrate (→ primärer Aufruf; Fallback bei fehlendem Script)
#   - pnpm -w dev (→ Start des Workspace-Dev-Prozesses)
#   - Ausführbar: via `chmod +x scripts/bootstrap_repo.sh`
# -----------------------------------------------------------------------------
