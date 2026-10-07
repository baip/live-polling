export type QuestionType = "mc" | "wordcloud" | "quiz" | "feedback";

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  title?: string;
  description?: string;
  /** mc/quiz only, 2–6 entries */
  options?: string[];
  /** quiz only */
  correctIndex?: number;
  /** quiz only, seconds (default 20) */
  timeLimitSec?: number;
  /** show leaderboard after this question */
  showLeaderboard?: boolean;
  /** wordcloud: allow multiple entries per participant */
  allowMultiple?: boolean;
}

export type PresentationStatus = "lobby" | "active" | "revealing" | "closed";

export interface PublicQuestion {
  id: number;
  idx: number;
  type: QuestionType;
  prompt: string;
  title: string | null;
  description: string | null;
  options: string[] | null;
  timeLimitSec: number | null;
  showLeaderboard: boolean;
  allowMultiple: boolean;
  /** Only present for the presenter or after reveal. */
  correctIndex?: number | null;
  /** Server timestamp (ms) when this question became active — for quiz countdown. */
  startedAt?: number | null;
}

export interface ChoiceResults {
  kind: "choice";
  counts: number[];
  total: number;
}

export interface WordResults {
  kind: "words";
  words: { text: string; count: number }[];
  total: number;
}

export type Results = ChoiceResults | WordResults;

export interface LeaderboardEntry {
  participantId: string;
  nickname: string;
  score: number;
}

export interface MyResponse {
  value: string;
  points: number;
}

export interface StateResponse {
  code: string;
  title: string;
  status: PresentationStatus;
  currentIndex: number;
  questionCount: number;
  participantCount: number;
  isPresenter: boolean;
  currentQuestion: PublicQuestion | null;
  myResponse: MyResponse | null;
  myResponses?: MyResponse[] | null;
  results: Results | null;
  leaderboard: LeaderboardEntry[] | null;
  /** Server time (ms) — clients use this to sync countdown timers. */
  serverTime: number;
}

export interface CreatePresentationRequest {
  title: string;
  questions: QuestionInput[];
}

export interface CreatePresentationResponse {
  code: string;
  presenterKey: string;
}

export interface JoinResponse {
  participantId: string;
}

export type ControlAction = "start" | "reveal" | "next" | "close";

export interface RespondResponse {
  ok: true;
  points: number;
}
