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
];

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
