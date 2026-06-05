
export const DIRTY_ORDERBOOK_PRICES : Record<string, Set<number>> = {} ;

export const pushDirtyPrices = (stockSymbol:string, price:number) => {
  if(!DIRTY_ORDERBOOK_PRICES[stockSymbol]){
    DIRTY_ORDERBOOK_PRICES[stockSymbol] = new Set<number>();
  }
  DIRTY_ORDERBOOK_PRICES[stockSymbol].add(price)
}