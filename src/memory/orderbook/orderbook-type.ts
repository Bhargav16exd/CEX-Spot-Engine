
export interface OrderbookStoreType {
  [stockName: string]: StockSpecificOrderbookStoreType
}

export interface OrderbookIndexStoreType {
  [stockName: string]: StockSpecificOrderbookIndexStoreType
}

interface StockSpecificOrderbookIndexStoreType {
  ask:number[],
  bid:number[]
}

interface StockSpecificOrderbookStoreType {
  updateId:number;
  ask:AskType,
  bid:BidType
}

interface AskType {
  [price :string]:TransactionEntityType
}

interface BidType {
  [price :string]:TransactionEntityType
}

interface TransactionEntityType {
  totalQuantity:number;
  remainingQuantity:number;
  makerIds: Record<string, Array<string>>;
  takerIds: Record<string, Array<string>>;
}