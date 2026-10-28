export type Meal = 'before' | 'after' | 'any';
export type DoseStatus = 'planned' | 'taken' | 'missed' | 'skipped';
export type DocKind = 'analysis' | 'report' | 'other';
export type ConditionKind = 'diagnosis' | 'allergy';
export type VitalKind = 'heart_rate' | 'steps' | 'sleep_minutes';
export type ChatRole = 'user' | 'assistant';

export type MedicationRow = {
  id: number;
  name: string;
  dosage: string | null;
  form: string | null;
  meal: Meal;
  course_days: number | null;
  started_on: string;
  note: string | null;
  catalog_id: string | null;
  archived: number;
  created_at: string;
};

export type ScheduleTimeRow = {
  id: number;
  medication_id: number;
  hour: number;
  minute: number;
  notification_id: string | null;
};

export type DoseRow = {
  id: number;
  medication_id: number;
  schedule_time_id: number | null;
  planned_at: string;
  status: DoseStatus;
  acted_at: string | null;
  synced: number;
};

/** Доза вместе с данными лекарства — то, что рисуют экраны. */
export type DoseWithMedication = DoseRow & {
  name: string;
  dosage: string | null;
  form: string | null;
  meal: Meal;
};

export type DocumentRow = {
  id: number;
  title: string;
  kind: DocKind;
  uri: string;
  mime: string | null;
  taken_on: string | null;
  created_at: string;
};

export type ConditionRow = {
  id: number;
  kind: ConditionKind;
  label: string;
  created_at: string;
};

export type VitalRow = {
  id: number;
  kind: VitalKind;
  value: number;
  measured_at: string;
  source: string | null;
};

export type MessageRow = {
  id: number;
  role: ChatRole;
  text: string;
  created_at: string;
};

/** Лекарство с его временами приёма — форма редактирования и планировщик. */
export type Medication = MedicationRow & { times: ScheduleTimeRow[] };
