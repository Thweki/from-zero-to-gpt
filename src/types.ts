import { lessonIds } from './data/lesson-ids';
import type {TutorSelection} from './tutor-selection';
export type LessonId = typeof lessonIds[number];
export type ViewMode = 'intuition' | 'math' | 'code' | 'deep';
export type LessonStatus = 'new' | 'learning' | 'mastered';
export interface Lesson {
  id: LessonId;
  number: string;
  title: string;
  english: string;
  subtitle: string;
  prerequisites: LessonId[];
  goals: string[];
  problem: string;
  intuition: { title: string; paragraphs: string[] }[];
  math: { title: string; paragraphs: string[]; formula?: string }[];
  deep: { title: string; paragraphs: string[] }[];
  formula: string;
  formulaCaption: string;
  lab: 'function' | 'linear' | 'vector' | 'dot' | 'math-advanced' | 'machine-learning' | 'neural-network' | 'transformer' | 'gpt' | 'modern-llm';
  runtime?: 'browser' | 'local-python';
  labTask: string;
  starter: string;
  reference: string;
  codeExplanation: string;
  pythonTests: string;
  misconceptions: string[];
  exercise: string;
  quiz: { question: string; options: string[]; correct: number; explanation: string; hint: string };
  references: { title: string; url: string; note: string }[];
}
export interface LessonProgress {
  status: LessonStatus;
  mode: ViewMode;
  note: string;
  code: string;
  review: boolean;
  quizAnswer?: number;
  quizPassed?: boolean;
  labValues?: Record<string, number>;
  lastRun?: string;
  tutorMessages?: TutorMessage[];
  tutorDraft?: string;
  tutorSelection?: TutorSelection;
}
export interface Checkpoint {
  lessonId: LessonId;
  question: string;
  next: string;
  savedAt: string;
  code: string;
  runResult: string;
}
export interface LearningState {
  version: 1;
  theme: 'light' | 'dark';
  lastLesson: LessonId;
  progress: Partial<Record<LessonId, LessonProgress>>;
  checkpoint?: Checkpoint;
  updatedAt: string;
}

export interface TutorMessage { role: 'user' | 'assistant'; content: string; createdAt: string; selection?: TutorSelection; }
export interface ExtendedLabProps { lesson: Lesson; values: Record<string,number>; onChange: (values:Record<string,number>)=>void; }
