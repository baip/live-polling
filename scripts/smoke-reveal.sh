#!/bin/bash
# Focused: reveal exposes counts + correctIndex after reveal on a quiz.
set -e
BASE=${BASE:-http://localhost:5173}
PASS=${PASS:-dev-passcode}
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
POST() { curl -s -X POST "$1" -H 'Content-Type: application/json' -d "$2"; }

CREATE=$(POST $BASE/api/presentations "{\"title\":\"R\",\"questions\":[{\"type\":\"quiz\",\"prompt\":\"Q?\",\"options\":[\"A\",\"B\"],\"correctIndex\":1}],\"passcode\":\"$PASS\"}")
CODE=$(echo "$CREATE" | J "['code']")
KEY=$(echo "$CREATE" | J "['presenterKey']")
P=$(POST $BASE/api/presentations/$CODE/join '{"nickname":"a"}' | J "['participantId']")
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"start\"}" > /dev/null
QID=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
POST $BASE/api/presentations/$CODE/respond "{\"participantId\":\"$P\",\"questionId\":$QID,\"value\":1}" > /dev/null
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
curl -s "$BASE/api/presentations/$CODE/state?participantId=$P" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('results:', d['results'])
print('correctIndex:', d['currentQuestion']['correctIndex'])
assert d['results'] == {'kind':'choice','counts':[0,1],'total':1}
assert d['currentQuestion']['correctIndex'] == 1
print('OK')"
