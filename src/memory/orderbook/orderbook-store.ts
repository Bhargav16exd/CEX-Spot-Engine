import type { SideSpot } from "@cex/shared";
import type { OrderbookIndexStoreType, OrderbookStoreType } from "./orderbook-type.js";

// export const ORDERBOOK_STORE:OrderbookStoreType = {};

export const ORDERBOOK_STORE: OrderbookStoreType = {
	sol: {
    updateId:0,
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

/*
  ------- ORDERBOOK MODFIERS ------
  ---------------------------------
*/

export const pushOrderIdInMakerIds = (symbol:string, side:SideSpot, price:number, userId:string, orderId:string) =>{

  if(!ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId]){
    ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId] = [orderId]
    return 
  }

  ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId].push(orderId);
}

export const removeOrderIdInMakerIds = (symbol:string, side:SideSpot, price:number, userId:string, orderId:string) =>{

  if(!ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId]){
    return 
  }

  const orderIds = ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId]

  ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId] = orderIds.filter((id:string) => id != orderId);

  if(ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId].length === 0 ){
    delete  ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId]
  }
}

export const addPriceToOrderBookIndex = (stockSymbol:string, side:SideSpot, price:number) => {

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
    throw new Error("Stock Already Exist in SPOT MARKET");
  }

  ORDERBOOK_STORE[stockSymbol] = {
    updateId:0,
		bid:{},
		ask:{}
  }

  ORDERBOOK_STORE_INDEX[stockSymbol] = {
    bid:[],
    ask:[]
  }

  return true
}

export const incrementUpdateId = (symbol:string) => {
  ORDERBOOK_STORE[symbol]!.updateId! = ORDERBOOK_STORE[symbol]?.updateId! + 1 
}