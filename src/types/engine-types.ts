export type EngineCommandType =
  | "create_order"
  | "get_depth"
  | "get_user_balance"
  | "get_order"
  | "cancel_order"
  | "create_stock_entity"
  | "update_balance"

export interface EngineRequestType {
  transactionId: string;
  responseQueue: string;
  type: EngineCommandType;
  payload: Record<string, unknown>;
}

export interface EngineResponseType {
  transactionId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}