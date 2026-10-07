#!/bin/bash
# Auth flow smoke test. Local: PRESENTER_PASSCODE=dev-passcode in .dev.vars.
set -e
BASE=${BASE:-http://localhost:5173}
PASS=${PASS:-dev-passcode}
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
POST() { curl -s -X POST "$1" -H 'Content-Type: application/json' -d "$2"; }

echo "=== config (expect passcodeEnabled: true)"
curl -s $BASE/api/config
echo ""

echo "=== create without token (expect 401)"
curl -s -w " [%{http_code}]\n" -X POST $BASE/api/presentations -H 'Content-Type: application/json' \
  -d '{"title":"x","questions":[{"type":"mc","prompt":"Q?","options":["A","B"]}]}'

echo "=== passcode login (wrong → 403, right → token)"
POST $BASE/api/auth/passcode '{"passcode":"wrong"}' | head -c 60; echo ""
TOKEN=$(POST $BASE/api/auth/passcode "{\"passcode\":\"$PASS\"}" | J "['token']")
echo "token=${TOKEN:0:8}…"

echo "=== create with token (expect 201)"
POST $BASE/api/presentations "{\"title\":\"Authed\",\"questions\":[{\"type\":\"mc\",\"prompt\":\"Q?\",\"options\":[\"A\",\"B\"]}],\"presenterToken\":\"$TOKEN\"}" | head -c 80
echo ""

echo "=== email login: non-allowlisted (expect 403 not_allowed)"
POST $BASE/api/auth/email '{"email":"nobody@example.com"}' | head -c 60; echo ""

echo "=== email login: allowlisted (email delivery depends on RESEND_API_KEY)"
RESP=$(POST $BASE/api/auth/email '{"email":"pengbai95@gmail.com"}')
echo "$RESP"
if echo "$RESP" | grep -q '"ok":true'; then
  echo "--- retrieve PIN from local D1 and verify"
  HASH=$(npx wrangler d1 execute live-polling-db --local --command \
    "SELECT code_hash FROM email_login_codes WHERE email='pengbai95@gmail.com'" --json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['results'][0]['code_hash'])")
  echo "(hash present: $([ -n "$HASH" ] && echo yes))"
  echo "--- wrong PIN (expect 403)"
  POST $BASE/api/auth/verify '{"email":"pengbai95@gmail.com","code":"000000"}' | head -c 60; echo ""
else
  echo "(email not configured locally — skipping PIN verify; passcode path already verified)"
fi

echo "=== bad token rejected (expect 401)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/presentations -H 'Content-Type: application/json' \
  -d '{"title":"x","questions":[{"type":"mc","prompt":"Q?","options":["A","B"]}],"presenterToken":"bogus"}'
echo "AUTH SMOKE DONE"
