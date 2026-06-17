export interface ChangeEvent {
  seq: number;
  event: string;
  cardId: string;
  action: string | null;
  field: string | null;
  actor: string | null;
  payload: Record<string, unknown>;
  at: number;
}

export interface ChangeRow {
  seq: number;
  event: string;
  card_id: string;
  action: string | null;
  field: string | null;
  actor: string | null;
  payload_json: string;
  at: number;
}
