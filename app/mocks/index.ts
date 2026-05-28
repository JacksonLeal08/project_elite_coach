import { User, Student } from '../types';

export const MOCK_USERS: User[] = [
  { id: 1, name: 'Jackson Leal', email: 'jackson602@gmail.com', role: 'Desenvolvedor', unremovable: true, pass: '798621' },
  { id: 2, name: 'Jaira Leal', email: 'jaira@elitecoach.com', role: 'Administrador', unremovable: false },
  { id: 3, name: 'Carlos Silva', email: 'carlos@elitecoach.com', role: 'Treinador', unremovable: false },
];

export const MOCK_STUDENTS: Student[] = [
  { id: 1, name: 'Marcus Johnson', age: 28, goal: 'Hipertrofia', biotype: 'Mesomorfo', status: 'Ativo', imc: 22.5, badges: [{name: 'Comprometido', icon: '🔥'}, {name: 'Evolução Rápida', icon: '🚀'}] },
  { id: 2, name: 'Sarah Connor', age: 34, goal: 'Perda de Peso', biotype: 'Endomorfo', status: 'Ativo', imc: 28.1, badges: [{name: 'Foco Total', icon: '🎯'}] },
  { id: 3, name: 'David Lee', age: 41, goal: 'Resistência', biotype: 'Ectomorfo', status: 'Inativo', imc: 24.0, badges: [] },
];
export const MOCK_PROGRESSION = [
  { week: 'Sem 1', load: 120, volume: 3000 },
  { week: 'Sem 2', load: 135, volume: 3200 },
  { week: 'Sem 3', load: 140, volume: 3450 },
  { week: 'Sem 4', load: 155, volume: 3800 },
  { week: 'Sem 5', load: 170, volume: 4100 },
  { week: 'Sem 6', load: 185, volume: 4500 },
];

export const MOCK_ACTIVITIES = [
  { id: 1, msg: 'Novo registro de peso inserido.', time: '10 min atrás', user: 'Marcus J.' },
  { id: 2, msg: 'Treino de Hipertrofia A concluído.', time: '1h atrás', user: 'Sarah C.' },
  { id: 3, msg: 'Protocolo expirando em 2 dias.', time: 'Ontem', user: 'David L.' },
];
