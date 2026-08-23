import { Question, Qualification } from '../../types';
import { ELETRICIDADE_QUESTIONS } from './eletricidade';
import { MECANICA_QUESTIONS } from './mecanica';
import { CONSTRUCAO_QUESTIONS } from './construcao';
import { CONTABILIDADE_QUESTIONS } from './contabilidade';
import { GESTAO_QUESTIONS } from './gestao';
import { ENSINO_GERAL_QUESTIONS } from './ensinoGeral';
import { INFORMATICA_QUESTIONS } from './informatica';
import { CIENCIA_LEIS_QUESTIONS } from './cienciaLeis';

export const ALL_INITIAL_QUESTIONS: Question[] = [
  ...ELETRICIDADE_QUESTIONS,
  ...MECANICA_QUESTIONS,
  ...CONSTRUCAO_QUESTIONS,
  ...CONTABILIDADE_QUESTIONS,
  ...GESTAO_QUESTIONS,
  ...ENSINO_GERAL_QUESTIONS,
  ...INFORMATICA_QUESTIONS,
  ...CIENCIA_LEIS_QUESTIONS,
].map((q, idx) => {
  // Normalize difficulty and points according to exact user rules:
  // Fácil: 5-10 pts | Médio: 11-30 pts | Difícil: 31-60 pts | Extremamente Difícil: 61-100 pts
  let assignedDifficulty = q.difficulty;
  let points = q.points;

  // Distribute some questions to 'Extremamente Difícil' if idx % 5 === 0 and difficulty is Difícil/Especial
  if (q.difficulty === 'Especial' || (q.difficulty === 'Difícil' && idx % 4 === 0)) {
    assignedDifficulty = 'Extremamente Difícil';
  }

  if (assignedDifficulty === 'Fácil') {
    points = 5 + (idx % 6); // 5 to 10 pts
  } else if (assignedDifficulty === 'Médio') {
    points = 11 + (idx % 20); // 11 to 30 pts
  } else if (assignedDifficulty === 'Difícil') {
    points = 31 + (idx % 30); // 31 to 60 pts
  } else {
    // Extremamente Difícil / Especial
    points = 61 + (idx % 40); // 61 to 100 pts
  }

  return {
    ...q,
    difficulty: assignedDifficulty,
    points,
    time_limit: 20, // Strict 20s as requested by user
  };
});

export const QUESTIONS_DATABASE = ALL_INITIAL_QUESTIONS;

// Baseline estimated enterprise question bank count for UI statistics per qualification
export const ESTIMATED_BANK_COUNTS: Record<Qualification, number> = {
  'Eletricidade Industrial': 5420,
  'Mecânica Industrial': 4830,
  'Construção Civil': 3920,
  'Contabilidade': 2840,
  'Gestão': 3210,
  'Ensino Geral': 7540,
  'Informática & Tecnologia': 4630,
};
