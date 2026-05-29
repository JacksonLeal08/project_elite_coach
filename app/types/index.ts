export interface User {
  id: number | string;
  name: string;
  email: string;
  role: string;
  unremovable: boolean;
  pass?: string;
  avatar_url?: string;
  expires_at?: string;
}

export interface Badge {
  name: string;
  icon: string;
}

export interface Student {
  id: number | string;
  name: string;
  age: number;
  goal: string;
  biotype: string;
  status: string;
  imc: number;
  badges: Badge[];
  photo_url?: string;
  photo_front_url?: string;
  photo_back_url?: string;
  photo_side_url?: string;
  phone_number?: string;
  telegram_chat_id?: string;
}

export interface Anamnesis {
  id?: string;
  student_id: string;
  medical_restrictions: string;
  flexibility_level: string;
  water_intake: number;
  dietary_habits: string;
  surgical_history: string;
  medications: string;
  cardio_condition: string;
}

export interface Exercise {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  notes?: string;
}

export interface WorkoutDay {
  dayName: string;
  exercises: Exercise[];
}

export interface WorkoutData {
  days: WorkoutDay[];
}

export interface HistoryEntry {
  id: number | string;
  student: string;
  objective: string;
  split: string;
  days: string;
  needs?: string;
  durationWeeks: string;
  weight?: string;
  height?: string;
  imc?: string;
  clinicalNotes?: string;
  workoutData: WorkoutData;
  date: string;
}

export interface ProfileConfig {
  name: string;
  email: string;
  specialty?: string;
  instagram?: string;
  whatsapp?: string;
  logoUrl?: string;
  pdfTemplate: string;
}

export interface ProgressionData {
  week: string;
  load: number;
  volume: number;
}

export interface ActivityEntry {
  id: number;
  msg: string;
  time: string;
  user: string;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  due_date: string;
  payment_date?: string | null;
  status: 'Pago' | 'Pendente' | 'Atrasado';
  plan_name: string;
  created_at: string;
}
