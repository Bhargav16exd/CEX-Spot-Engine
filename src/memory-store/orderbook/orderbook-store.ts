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