export type QuestionType = "mc" | "wordcloud" | "quiz";

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  /** mc/quiz only, 2–6 entries */
  options?: string[];
  /** quiz only */
  correctIndex?: number;
  /** quiz only, seconds (default 20) */
  timeLimitSec?: number;
}

export type PresentationStatus = "lobby" | "active" | "revealing" | "closed";

export interface PublicQuestion {
  id: number;
  idx: number;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  timeLimitSec: number | null;
  /** Only present for the presenter or after reveal. */
  correctIndex?: number | null;
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
  results: Results | null;
  leaderboard: LeaderboardEntry[] | null;
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
