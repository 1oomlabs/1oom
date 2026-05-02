#!/usr/bin/env bash
# Sets up the AXL runtime for the loomlabs two-node demo.
# Idempotent: re-running keeps existing keys + configs.
#
# Usage:
#   bash examples/axl-agents/setup.sh
#
# Override the install root:
#   LOOM_AXL_RUNTIME_ROOT=/some/path bash examples/axl-agents/setup.sh
#
# Layout when done:
#   $LOOM_AXL_RUNTIME_ROOT/
#     axl/                 cloned gensyn-ai/axl + built `node` binary
#     demo/node-a/         ed25519 key + node-config.json (api_port 9002)
#     demo/node-b/         ed25519 key + node-config.json (api_port 9012)

set -euo pipefail

ROOT="${LOOM_AXL_RUNTIME_ROOT:-$HOME/Develop/axl-runtime}"
AXL_REPO="$ROOT/axl"
DEMO_DIR="$ROOT/demo"

echo "==> Target: $ROOT"

# --- Go check ---------------------------------------------------------------
if ! command -v go >/dev/null 2>&1; then
  echo "ERROR: Go is not installed. AXL requires Go 1.25.5+." >&2
  echo "  macOS: brew install go" >&2
  echo "  Linux: see https://go.dev/dl/" >&2
  exit 1
fi
echo "==> Go: $(go version)"

# --- OpenSSL with ed25519 support ------------------------------------------
# macOS ships LibreSSL which lacks ed25519 — use Homebrew openssl@3.
OPENSSL_BIN=""
if [[ "$OSTYPE" == "darwin"* ]]; then
  for candidate in /opt/homebrew/bin/openssl /usr/local/opt/openssl@3/bin/openssl; do
    if [[ -x "$candidate" ]]; then
      OPENSSL_BIN="$candidate"
      break
    fi
  done
  if [[ -z "$OPENSSL_BIN" ]]; then
    echo "ERROR: macOS LibreSSL does not support ed25519. Install OpenSSL 3:" >&2
    echo "  brew install openssl@3" >&2
    exit 1
  fi
else
  OPENSSL_BIN="$(command -v openssl)"
  if [[ -z "$OPENSSL_BIN" ]]; then
    echo "ERROR: openssl not found in PATH." >&2
    exit 1
  fi
fi
echo "==> OpenSSL: $($OPENSSL_BIN version) ($OPENSSL_BIN)"

# --- Clone ------------------------------------------------------------------
mkdir -p "$ROOT"
if [[ ! -d "$AXL_REPO/.git" ]]; then
  echo "==> Cloning gensyn-ai/axl into $AXL_REPO"
  git clone https://github.com/gensyn-ai/axl.git "$AXL_REPO"
else
  echo "==> AXL repo exists at $AXL_REPO (skipping clone)"
fi

# --- Build ------------------------------------------------------------------
if [[ ! -x "$AXL_REPO/node" ]]; then
  echo "==> Building AXL binary (this can take a minute on first run)"
  (cd "$AXL_REPO" && make build)
else
  echo "==> AXL binary exists at $AXL_REPO/node (skipping build)"
fi

# --- Per-node keys ----------------------------------------------------------
for n in a b; do
  NODE_DIR="$DEMO_DIR/node-$n"
  mkdir -p "$NODE_DIR"
  if [[ ! -f "$NODE_DIR/private.pem" ]]; then
    echo "==> Generating ed25519 key for node-$n"
    "$OPENSSL_BIN" genpkey -algorithm ed25519 -out "$NODE_DIR/private.pem"
  else
    echo "==> node-$n key exists (skipping)"
  fi
done

# --- Configs ----------------------------------------------------------------
# node A is the listening hub on tls://0.0.0.0:9001 with HTTP API on :9002.
# node B peers outbound to node A and exposes HTTP API on :9012.
# Both share tcp_port 7000 — gVisor uses different IPv6 addresses internally,
# so the same TCP port is required for inter-node TCP to succeed.
cat > "$DEMO_DIR/node-a/node-config.json" <<'EOF'
{
  "PrivateKeyPath": "private.pem",
  "Peers": [],
  "Listen": ["tls://0.0.0.0:9001"],
  "api_port": 9002,
  "tcp_port": 7000
}
EOF

cat > "$DEMO_DIR/node-b/node-config.json" <<'EOF'
{
  "PrivateKeyPath": "private.pem",
  "Peers": ["tls://127.0.0.1:9001"],
  "Listen": [],
  "api_port": 9012,
  "tcp_port": 7000
}
EOF
echo "==> Wrote node-a/node-config.json (api_port 9002, listening hub)"
echo "==> Wrote node-b/node-config.json (api_port 9012, peers to node A)"

# --- Done -------------------------------------------------------------------
cat <<DONE

Setup complete.

Run the two nodes in separate terminals:
  Terminal 1:  cd $DEMO_DIR/node-a && $AXL_REPO/node -config node-config.json
  Terminal 2:  cd $DEMO_DIR/node-b && $AXL_REPO/node -config node-config.json

Once both nodes are up, capture each peer id (you will need node B's id as
AXL_DESTINATION_PEER_ID for the publisher):
  curl -s http://127.0.0.1:9002/topology | python3 -c "import sys,json;print('node A:', json.load(sys.stdin)['our_public_key'])"
  curl -s http://127.0.0.1:9012/topology | python3 -c "import sys,json;print('node B:', json.load(sys.stdin)['our_public_key'])"

Then run the publisher / receiver pair from this directory:
  AXL_NODE_URL=http://127.0.0.1:9012 pnpm receive
  AXL_NODE_URL=http://127.0.0.1:9002 \\
    AXL_DESTINATION_PEER_ID=<node-b-public-key> \\
    PUBLISH_TEMPLATE_ID=lido-stake \\
    pnpm publish

DONE
