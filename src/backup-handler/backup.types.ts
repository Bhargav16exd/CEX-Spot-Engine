
import type { OrderEntityType } from "@bhargav16exdd/cex";
import type { BalanceStoreType } from "../memory/balance/balance-type.js";
import type { OrderbookIndexStoreType, OrderbookStoreType } from "../memory/orderbook/orderbook-type.js";


export interface BackupTypes {
  ORDERBOOK_STORE : OrderbookStoreType,
  ORDERBOOK_STORE_INDEX : OrderbookIndexStoreType,
  BALANCE_STORE: BalanceStoreType,
  ORDERS : OrderEntityType,
  ACTIVE_ORDER_INDEX : Map<string, Map<string, Array<string>>>
  updatedAt:number
}