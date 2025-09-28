#!/usr/bin/env bash
# scripts/gen_openapi_types.sh
# TECHNIKER — TO-E: Typesync CI/Local Glue (Unix)
# Zweck: Aus OpenAPI 3.1 die *.d.ts für GateEngine generieren.
# Annahme: Repository-Root enthält ./contracts und ./packages/shared/src/generated
# Policy: Exit≠0 bei Fehler; KEIN Auto-Commit. One-File-Policy eingehalten.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# Pfade & Defaults
# ──────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Standard-Input (kann via CLI-Args überschrieben werden)
OAS_FILE_DEFAULT="${REPO_ROOT}/contracts/openapi-gateengine.v1.yaml"
OUT_FILE_DEFAULT="${REPO_ROOT}/packages/shared/src/generated/gateengine.d.ts"

OAS_FILE="${1:-$OAS_FILE_DEFAULT}"
OUT_FILE="${2:-$OUT_FILE_DEFAULT}"

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
function die() {
  echo "[gen_openapi_types] ERROR: $*" >&2
  exit 1
}

function info() {
  echo "[gen_openapi_types] $*"
}

function ensure_dir() {
  local dir
  dir="$(dirname "$1")"
  mkdir -p "$dir"
}

function resolve_cli() {
  # Bevorzugt lokales Binary, dann global, dann pnpm dlx, dann npx.
  if [[ -x "${REPO_ROOT}/node_modules/.bin/openapi-typescript" ]]; then
    echo "${REPO_ROOT}/node_modules/.bin/openapi-typescript"
    return 0
  fi
  if command -v openapi-typescript >/dev/null 2>&1; then
    echo "openapi-typescript"
    return 0
  fi
  if command -v pnpm >/dev/null 2>&1; then
    echo "pnpm dlx openapi-typescript"
    return 0
  fi
  if command -v npx >/dev/null 2>&1; then
    echo "npx -y openapi-typescript"
    return 0
  fi
  return 1
}

function usage() {
  cat <<'USAGE'
Usage:
  scripts/gen_openapi_types.sh [OPENAPI_YAML] [OUT_D_TS]

Defaults:
  OPENAPI_YAML = contracts/openapi-gateengine.v1.yaml
  OUT_D_TS     = packages/shared/src/generated/gateengine.d.ts

Beispiele:
  ./scripts/gen_openapi_types.sh
  ./scripts/gen_openapi_types.sh contracts/openapi-gateengine.v1.yaml packages/shared/src/generated/gateengine.d.ts
USAGE
}

# ──────────────────────────────────────────────────────────────────────────────
# Preflight
# ──────────────────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

[[ -f "$OAS_FILE" ]] || die "OpenAPI-Datei nicht gefunden: $OAS_FILE"

CLI="$(resolve_cli)" || die "openapi-typescript nicht gefunden (weder lokal noch via pnpm/npx). Bitte installieren."

ensure_dir "$OUT_FILE"

# ──────────────────────────────────────────────────────────────────────────────
# Generierung
# ──────────────────────────────────────────────────────────────────────────────
info "Starte Typ-Generierung"
info "OAS:  $OAS_FILE"
info "OUT:  $OUT_FILE"
info "CLI:  $CLI"

# shellcheck disable=SC2086
$CLI "$OAS_FILE" -o "$OUT_FILE"

info "Fertig. Typen geschrieben nach: $OUT_FILE"

# ──────────────────────────────────────────────────────────────────────────────
# Referenzblock – Kap. 17.4 (Dokumentation im File)
# ──────────────────────────────────────────────────────────────────────────────
# Datei: scripts/gen_openapi_types.sh
# Deliverable: TO-E — Typesync CI/Local Glue (Unix)
# Autor/Abteilung: TECHNIKER
# Datum: 2025-09-19
#
# Quelle der Wahrheit (SSOT):
# - Kap. 18 Meta-Governance (Contracts als SSOT; Typsync vorgeschrieben)
# - Kap. 19.3 Integrität & Datenmodell (Generierung statt Hand-Typen)
# - Kap. 28 Change-Log & SemVer
#
# Akzeptanzkriterien (TO-E) — Nachweis:
# - Lauffähig unter bash ✔
# - Aufruf: openapi-typescript contracts/openapi-gateengine.v1.yaml -o packages/shared/src/generated/gateengine.d.ts ✔
# - Exit≠0 bei Fehler (set -euo pipefail + Checks) ✔
#
# Hinweise:
# - CI kann dieses Skript direkt ausführen.
# - Optional können weitere OAS-Ziele via CLI-Args generiert werden.
#
# Orchestrator-Handover (Einzeiler):
# powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
#   -Chat TECHNIKER `
#   -Gate "Welle 1" `
#   -Status "delivered — TO-E Typesync-Skript (Unix) bereit" `
#   -Deliverable "scripts/gen_openapi_types.sh" `
#   -Summary "openapi-typescript Glue; Exit≠0 bei Fehler; kein Auto-Commit"
