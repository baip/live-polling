import { Hono } from "hono";
import type {
  CreatePresentationRequest,
  LeaderboardEntry,
  PresentationStatus,
  QuestionInput,
  QuestionType,
  Results,
  StateResponse,
} from "../shared/types";

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
};

interface PresentationRow {
  code: string;
  presenter_key: string;
  title: string;
  status: PresentationStatus;
  current_index: number;
  question_started_at: number | null;
  created_at: number;
}

interface QuestionRow {
  id: number;
  presentation_code: string;
  idx: number;
  type: QuestionType;
  prompt: string;
  options: string | null;
  correct_index: number | null;
  time_limit_sec: number | null;
}

interface ParticipantRow {
  id: string;
  presentation_code: string;
  nickname: string;
  created_at: number;
}

const app = new Hono<{ Bindings: Bindings }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // unambiguous chars only

function genCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

function validateQuestion(q: QuestionInput): string | null {
  if (!q || (q.type !== "mc" && q.type !== "quiz" && q.type !== "wordcloud")) return "unknown type";
  if (typeof q.prompt !== "string" || q.prompt.trim().length === 0 || q.prompt.length > 300)
    return "bad prompt";
  if (q.type === "mc" || q.type === "quiz") {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6)
      return "needs 2–6 options";
    if (q.options.some((o) => typeof o !== "string" || o.trim().length === 0))
      return "empty option";
    if (q.type === "quiz") {
      if (
        typeof q.correctIndex !== "number" ||
        !Number.isInteger(q.correctIndex) ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.options.length
      )
        return "bad correctIndex";
      if (
        q.timeLimitSec != null &&
        (typeof q.timeLimitSec !== "number" || q.timeLimitSec < 5 || q.timeLimitSec > 300)
      )
        return "bad timeLimitSec";
    }
  }
  return null;
}

async function getPresentation(db: D1Database, code: string): Promise<PresentationRow | null> {
  return db.prepare("SELECT * FROM presentations WHERE code = ?").bind(code).first<PresentationRow>();
}

async function aggregate(db: D1Database, q: QuestionRow): Promise<Results> {
  const total =
    (
      await db
        .prepare("SELECT COUNT(*) AS n FROM responses WHERE question_id = ?")
        .bind(q.id)
        .first<{ n: number }>()
    )?.n ?? 0;

  if (q.type === "wordcloud") {
    const rows = await db
      .prepare(
        "SELECT value, COUNT(*) AS n FROM responses WHERE question_id = ? GROUP BY value ORDER BY n DESC LIMIT 60"
      )
      .bind(q.id)
      .all<{ value: string; n: number }>();
    return { kind: "words", words: rows.results.map((r) => ({ text: r.value, count: r.n })), total };
  }

  const options = q.options ? (JSON.parse(q.options) as string[]) : [];
  const counts = options.map(() => 0);
  const rows = await db
    .prepare("SELECT value, COUNT(*) AS n FROM responses WHERE question_id = ? GROUP BY value")
    .bind(q.id)
    .all<{ value: string; n: number }>();
  for (const r of rows.results) {
    const i = Number(r.value);
    if (Number.isInteger(i) && i >= 0 && i < counts.length) counts[i] += r.n;
  }
  return { kind: "choice", counts, total };
}

async function getLeaderboard(db: D1Database, code: string): Promise<LeaderboardEntry[]> {
  const rows = await db
    .prepare(
      `SELECT p.id AS participantId, p.nickname AS nickname, COALESCE(SUM(r.points), 0) AS score
       FROM participants p
       LEFT JOIN responses r ON r.participant_id = p.id
       WHERE p.presentation_code = ?
       GROUP BY p.id
       ORDER BY score DESC, p.created_at ASC
       LIMIT 50`
    )
    .bind(code)
    .all<LeaderboardEntry>();
  return rows.results;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.post("/api/presentations", async (c) => {
  const body = await c.req.json<CreatePresentationRequest>().catch(() => null);
  if (!body || typeof body.title !== "string" || !Array.isArray(body.questions))
    return c.json({ error: "invalid_body" }, 400);

  const title = body.title.trim().slice(0, 120) || "Untitled";
  const qs = body.questions;
  if (qs.length < 1 || qs.length > 20) return c.json({ error: "need 1–20 questions" }, 400);
  for (const q of qs) {
    const problem = validateQuestion(q);
    if (problem) return c.json({ error: `invalid question: ${problem}` }, 400);
  }

  const presenterKey = crypto.randomUUID();
  const now = Date.now();
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    code = genCode();
    const clash = await c.env.DB
      .prepare("SELECT code FROM presentations WHERE code = ?")
      .bind(code)
      .first();
    if (!clash) break;
  }

  const stmts = [
    c.env.DB
      .prepare(
        "INSERT INTO presentations (code, presenter_key, title, status, current_index, created_at) VALUES (?, ?, ?, 'lobby', -1, ?)"
      )
      .bind(code, presenterKey, title, now),
    ...qs.map((q, i) =>
      c.env.DB
        .prepare(
          "INSERT INTO questions (presentation_code, idx, type, prompt, options, correct_index, time_limit_sec) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          code,
          i,
          q.type,
          q.prompt.trim(),
          q.options ? JSON.stringify(q.options.map((o) => o.trim())) : null,
          q.correctIndex ?? null,
          q.timeLimitSec ?? null
        )
    ),
  ];
  await c.env.DB.batch(stmts);

  return c.json({ code, presenterKey }, 201);
});

app.post("/api/presentations/:code/join", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const p = await getPresentation(c.env.DB, code);
  if (!p) return c.json({ error: "not_found" }, 404);
  if (p.status === "closed") return c.json({ error: "session_closed" }, 410);

  const body = await c.req.json<{ nickname?: string }>().catch(() => null);
  const nickname = (body?.nickname ?? "").trim().slice(0, 30);
  if (!nickname) return c.json({ error: "nickname required" }, 400);

  const participantId = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO participants (id, presentation_code, nickname, created_at) VALUES (?, ?, ?, ?)")
    .bind(participantId, code, nickname, Date.now())
    .run();

  return c.json({ participantId }, 201);
});

app.get("/api/presentations/:code/state", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const presenterKey = c.req.query("presenterKey") ?? null;
  const participantId = c.req.query("participantId") ?? null;

  const p = await getPresentation(c.env.DB, code);
  if (!p) return c.json({ error: "not_found" }, 404);

  const isPresenter = !!presenterKey && presenterKey === p.presenter_key;

  let participant: ParticipantRow | null = null;
  if (participantId) {
    participant = await c.env.DB
      .prepare("SELECT * FROM participants WHERE id = ? AND presentation_code = ?")
      .bind(participantId, code)
      .first<ParticipantRow>();
  }

  const participantCount =
    (
      await c.env.DB
        .prepare("SELECT COUNT(*) AS n FROM participants WHERE presentation_code = ?")
        .bind(code)
        .first<{ n: number }>()
    )?.n ?? 0;
  const questionCount =
    (
      await c.env.DB
        .prepare("SELECT COUNT(*) AS n FROM questions WHERE presentation_code = ?")
        .bind(code)
        .first<{ n: number }>()
    )?.n ?? 0;

  let question: QuestionRow | null = null;
  if (p.current_index >= 0) {
    question = await c.env.DB
      .prepare("SELECT * FROM questions WHERE presentation_code = ? AND idx = ?")
      .bind(code, p.current_index)
      .first<QuestionRow>();
  }

  const reveal = isPresenter || p.status === "revealing" || p.status === "closed";

  let myResponse: { value: string; points: number } | null = null;
  if (participant && question) {
    myResponse = await c.env.DB
      .prepare("SELECT value, points FROM responses WHERE question_id = ? AND participant_id = ?")
      .bind(question.id, participant.id)
      .first<{ value: string; points: number }>();
  }

  let results: Results | null = null;
  if (question && reveal) results = await aggregate(c.env.DB, question);

  let leaderboard: LeaderboardEntry[] | null = null;
  const quizCount =
    (
      await c.env.DB
        .prepare("SELECT COUNT(*) AS n FROM questions WHERE presentation_code = ? AND type = 'quiz'")
        .bind(code)
        .first<{ n: number }>()
    )?.n ?? 0;
  if (quizCount > 0 && reveal) leaderboard = await getLeaderboard(c.env.DB, code);

  const body: StateResponse = {
    code: p.code,
    title: p.title,
    status: p.status,
    currentIndex: p.current_index,
    questionCount,
    participantCount,
    isPresenter,
    currentQuestion: question
      ? {
          id: question.id,
          idx: question.idx,
          type: question.type,
          prompt: question.prompt,
          options: question.options ? (JSON.parse(question.options) as string[]) : null,
          timeLimitSec: question.time_limit_sec,
          correctIndex: reveal ? question.correct_index : null,
        }
      : null,
    myResponse,
    results,
    leaderboard,
  };
  return c.json(body);
});

app.post("/api/presentations/:code/respond", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const body = await c.req
    .json<{ participantId?: string; questionId?: number; value?: string | number }>()
    .catch(() => null);
  if (!body?.participantId || body.questionId == null || body.value == null)
    return c.json({ error: "invalid_body" }, 400);

  const p = await getPresentation(c.env.DB, code);
  if (!p) return c.json({ error: "not_found" }, 404);
  if (p.status !== "active") return c.json({ error: "not_accepting" }, 409);

  const q = await c.env.DB
    .prepare("SELECT * FROM questions WHERE presentation_code = ? AND idx = ?")
    .bind(code, p.current_index)
    .first<QuestionRow>();
  if (!q || q.id !== body.questionId) return c.json({ error: "wrong_question" }, 409);

  const participant = await c.env.DB
    .prepare("SELECT * FROM participants WHERE id = ? AND presentation_code = ?")
    .bind(body.participantId, code)
    .first<ParticipantRow>();
  if (!participant) return c.json({ error: "unknown_participant" }, 403);

  let value: string;
  let points = 0;
  if (q.type === "wordcloud") {
    if (typeof body.value !== "string") return c.json({ error: "invalid_value" }, 400);
    value = body.value.trim().toLowerCase().slice(0, 40);
    if (!value) return c.json({ error: "invalid_value" }, 400);
  } else {
    const idx = typeof body.value === "number" ? body.value : Number(body.value);
    const options = q.options ? (JSON.parse(q.options) as string[]) : [];
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length)
      return c.json({ error: "invalid_value" }, 400);
    value = String(idx);
    if (q.type === "quiz" && idx === q.correct_index) {
      const limit = q.time_limit_sec ?? 20;
      const elapsed = (Date.now() - (p.question_started_at ?? Date.now())) / 1000;
      const bonus = Math.max(0, 1 - elapsed / limit);
      points = 500 + Math.round(500 * bonus);
    }
  }

  const res = await c.env.DB
    .prepare(
      "INSERT OR IGNORE INTO responses (question_id, participant_id, value, points, answered_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(q.id, participant.id, value, points, Date.now())
    .run();
  if (res.meta.changes === 0) return c.json({ error: "already_answered" }, 409);

  return c.json({ ok: true, points }, 201);
});

app.post("/api/presentations/:code/control", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const body = await c.req
    .json<{ presenterKey?: string; action?: string }>()
    .catch(() => null);

  const p = await getPresentation(c.env.DB, code);
  if (!p) return c.json({ error: "not_found" }, 404);
  if (!body?.presenterKey || body.presenterKey !== p.presenter_key)
    return c.json({ error: "forbidden" }, 403);

  const now = Date.now();
  switch (body.action) {
    case "start": {
      if (p.status !== "lobby") return c.json({ error: "invalid_transition" }, 409);
      await c.env.DB
        .prepare(
          "UPDATE presentations SET status = 'active', current_index = 0, question_started_at = ? WHERE code = ?"
        )
        .bind(now, code)
        .run();
      return c.json({ ok: true });
    }
    case "reveal": {
      if (p.status !== "active") return c.json({ error: "invalid_transition" }, 409);
      await c.env.DB
        .prepare("UPDATE presentations SET status = 'revealing' WHERE code = ?")
        .bind(code)
        .run();
      return c.json({ ok: true });
    }
    case "next": {
      if (p.status !== "revealing" && p.status !== "active")
        return c.json({ error: "invalid_transition" }, 409);
      const questionCount =
        (
          await c.env.DB
            .prepare("SELECT COUNT(*) AS n FROM questions WHERE presentation_code = ?")
            .bind(code)
            .first<{ n: number }>()
        )?.n ?? 0;
      if (p.current_index + 1 >= questionCount) {
        await c.env.DB
          .prepare("UPDATE presentations SET status = 'closed' WHERE code = ?")
          .bind(code)
          .run();
      } else {
        await c.env.DB
          .prepare(
            "UPDATE presentations SET status = 'active', current_index = ?, question_started_at = ? WHERE code = ?"
          )
          .bind(p.current_index + 1, now, code)
          .run();
      }
      return c.json({ ok: true });
    }
    case "close": {
      await c.env.DB
        .prepare("UPDATE presentations SET status = 'closed' WHERE code = ?")
        .bind(code)
        .run();
      return c.json({ ok: true });
    }
    default:
      return c.json({ error: "unknown_action" }, 400);
  }
});

// ---------------------------------------------------------------------------
// SPA fallback: let the assets binding serve index.html for client routes.
// ---------------------------------------------------------------------------

app.notFound((c) => {
  if (c.req.method === "GET" && !c.req.path.startsWith("/api/")) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({ error: "not_found" }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
