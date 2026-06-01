import type { OrderbookIndexStoreType, OrderbookStoreType } from "./orderbook-type.js";

// export const ORDERBOOK_STORE:OrderbookStoreType = {};

export const ORDERBOOK_STORE: OrderbookStoreType = {
	sol: {
		ask:{},
		bid:{}
}
};

export const ORDERBOOK_STORE_INDEX: OrderbookIndexStoreType= {
	sol:{
		ask:[],
		bid:[]
	}
};

type Side = "ask" | "bid";

export const addPriceToOrderBookIndex = (stockSymbol:string,side:Side,price:number) => {

	if(!ORDERBOOK_STORE_INDEX[stockSymbol]){
		return
	}
	//push
	ORDERBOOK_STORE_INDEX[stockSymbol][side].push(price);
	//sort
	ORDERBOOK_STORE_INDEX[stockSymbol][side].sort((a,b)=> a - b);
}

export const handleCreateOrderEntityRequest = (payload:any) => {
  const { stockSymbol } = payload

  if(ORDERBOOK_STORE_INDEX[stockSymbol]){
    throw new Error("Stock Already Exist in PERP MARKET");
  }

  ORDERBOOK_STORE[stockSymbol] = {
		bid:{},
		ask:{}
  }

  ORDERBOOK_STORE_INDEX[stockSymbol] = {
    bid:[],
    ask:[]
  }

  return true
}