#!/bin/bash
# Smoke test for the v2 features: title/description, leaderboard toggle,
# hidden MC results, multi-entry wordcloud, feedback, quiz timer, export/import.
set -e
BASE=${BASE:-http://localhost:5173}
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
POST() { curl -s -X POST "$1" -H 'Content-Type: application/json' -d "$2"; }

echo "=== create presentation with all v2 fields"
CREATE=$(POST $BASE/api/presentations '{
  "title": "V2 Test",
  "questions": [
    {"type":"mc","prompt":"Pick one","title":"Opinion","description":"Choose carefully","options":["A","B"],"showLeaderboard":false},
    {"type":"wordcloud","prompt":"Words","allowMultiple":true},
    {"type":"quiz","prompt":"1+1?","options":["2","3"],"correctIndex":0,"timeLimitSec":8,"showLeaderboard":true},
    {"type":"feedback","prompt":"Any feedback?"}
  ]}')
CODE=$(echo "$CREATE" | J "['code']")
KEY=$(echo "$CREATE" | J "['presenterKey']")
echo "code=$CODE"

P=$(POST $BASE/api/presentations/$CODE/join '{"nickname":"alice"}' | J "['participantId']")

echo "=== start -> q1 (mc)"
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"start\"}" > /dev/null
Q1=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
POST $BASE/api/presentations/$CODE/respond "{\"participantId\":\"$P\",\"questionId\":$Q1,\"value\":1}" > /dev/null

echo "--- presenter sees results BEFORE reveal? (expect None)"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['results']"
echo "--- title/description present in state?"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "[['currentQuestion']['title'], ['currentQuestion']['description']]" 2>/dev/null || curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | python3 -c "import sys,json;q=json.load(sys.stdin)['currentQuestion'];print(q['title'],'|',q['description'])"

echo "=== reveal q1 -> results now visible with total"
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
curl -s "$BASE/api/presentations/$CODE/state?participantId=$P" | J "['results']"
echo "--- leaderboard shown for q1? showLeaderboard=false (expect None)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$P" | J "['leaderboard']"

echo "=== next -> q2 wordcloud (multi-entry)"
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}" > /dev/null
Q2=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
POST $BASE/api/presentations/$CODE/respond "{\"participantId\":\"$P\",\"questionId\":$Q2,\"value\":\"apple\"}" > /dev/null
echo "--- second entry same participant (expect 201, not 409):"
POST $BASE/api/presentations/$CODE/respond "{\"participantId\":\"$P\",\"questionId\":$Q2,\"value\":\"banana\"}"
echo ""
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
echo "--- wordcloud results (expect apple+banana, total 2):"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['results']"

echo "=== next -> q3 quiz (8s limit, showLeaderboard=true)"
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}" > /dev/null
Q3=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
echo "--- startedAt present? (expect a number)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$P" | J "['currentQuestion'].get('startedAt') is not None"
echo "--- correctIndex hidden before reveal? (expect None)"
curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion'].get('correctIndex')"
echo "--- wait past time limit, then answer (expect 409 time_expired):"
sleep 11
POST $BASE/api/presentations/$CODE/respond "{\"participantId\":\"$P\",\"questionId\":$Q3,\"value\":0}"
echo ""
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"reveal\"}" > /dev/null
echo "--- leaderboard shown after quiz reveal? (expect alice entry)"
curl -s "$BASE/api/presentations/$CODE/state?participantId=$P" | J "['leaderboard']"

echo "=== next -> q4 feedback"
POST $BASE/api/presentations/$CODE/control "{\"presenterKey\":\"$KEY\",\"action\":\"next\"}" > /dev/null
Q4=$(curl -s "$BASE/api/presentations/$CODE/state?presenterKey=$KEY" | J "['currentQuestion']['id']")
POST $BASE/api/presentations/$CODE/respond "{\"participantId\":\"$P\",\"questionId\":$Q4,\"value\":\"Great session, more quizzes please\"}" > /dev/null
echo "--- presenter feedback endpoint:"
curl -s "$BASE/api/presentations/$CODE/feedback?presenterKey=$KEY&questionId=$Q4"
echo ""
echo "--- feedback endpoint without key (expect 403):"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/presentations/$CODE/feedback?questionId=$Q4"

echo "=== export presentation JSON"
curl -s "$BASE/api/presentations/$CODE/export?presenterKey=$KEY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['format'], d['title'], len(d['questions']),'questions')"

echo "=== export results markdown (first 12 lines)"
curl -s "$BASE/api/presentations/$CODE/results.md?presenterKey=$KEY" | head -12

echo "=== import exported JSON as new session"
curl -s "$BASE/api/presentations/$CODE/export?presenterKey=$KEY" > /tmp/export.json
IMPORT=$(curl -s -X POST $BASE/api/presentations/import -H 'Content-Type: application/json' -d @/tmp/export.json)
echo "$IMPORT"
NEWCODE=$(echo "$IMPORT" | J "['code']")
echo "--- imported session state:"
curl -s "$BASE/api/presentations/$NEWCODE/state" | python3 -c "import sys,json;d=json.load(sys.stdin);print('title:',d['title'],'| questions:',d['questionCount'],'| status:',d['status'])"

echo "V2 SMOKE DONE"
