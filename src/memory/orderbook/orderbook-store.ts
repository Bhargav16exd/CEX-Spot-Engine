import { AdapterEntityType, AdapterMessageType, type SideSpot } from "@cex/shared";
import type { OrderbookIndexStoreType, OrderbookStoreType } from "./orderbook-type.js";
import { ACTIVE_ORDERS_INDEX, ORDERS } from "../orders/order.js";
import { queueMessageForAdapter } from "../../queue/db-publisher-client.js";
import { pushDirtyPrices } from "../dirty-prices/dirty-prices.js";

// export const ORDERBOOK_STORE:OrderbookStoreType = {};

export const ORDERBOOK_STORE: OrderbookStoreType = {};

export const ORDERBOOK_STORE_INDEX: OrderbookIndexStoreType= {};

export const removePriceFromOrderbookIndex = (symbol:string, inputPrice:number, side: SideSpot) => {
  
  const prices = ORDERBOOK_STORE_INDEX[symbol]!
  const updatedPrices = prices[side].filter((price) =>  price != inputPrice );

  ORDERBOOK_STORE_INDEX[symbol]![side] = updatedPrices
  return true
}

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
    
    delete ORDERBOOK_STORE[symbol]![side]![price]!.makerIds[userId]
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

/* 
  ------ LOADING BACKUPS IN MEMORY ------
  ---------------------------------------
*/

export const loadOrderbook = (orderbookBackup : OrderbookStoreType, orderbookIndexBackups : OrderbookIndexStoreType) => {
  Object.assign(ORDERBOOK_STORE, orderbookBackup);
  Object.assign(ORDERBOOK_STORE_INDEX, orderbookIndexBackups);
}

/* 
  ------ QUEUE REQUEST HANDLERS ------
  ------------------------------------
*/

export const handle_GET_DEPTH_Request = (payload:any):any => {
  const { stockSymbol } = payload;
  if(!ORDERBOOK_STORE[stockSymbol]){
    throw new Error("Stock Does Not Exist In Orderbook")
  }
  return {
    updateId:ORDERBOOK_STORE[stockSymbol].updateId,
    orderbook:ORDERBOOK_STORE[stockSymbol],
    orderbookIndex:ORDERBOOK_STORE_INDEX[stockSymbol],
  }
}

export const handle_CANCEL_ORDER_Request = (payload:any) => {
  try {
    const {userId, symbol, orderId} = payload;
  
    if(!ACTIVE_ORDERS_INDEX.get(userId)){
      throw new Error("User Dont Have Active Orders");
    }
  
    const symbolOrders = ACTIVE_ORDERS_INDEX.get(userId);
  
    if(!symbolOrders){
      throw new Error("No Active Orders Found");
    }
  
    const activeOrderIds = symbolOrders.get(symbol)
  
    if(!activeOrderIds || activeOrderIds.length == 0 ){
      throw new Error("No Active Orders Found");
    }

    if(!activeOrderIds.includes(orderId)){
      throw new Error("Invalid Order Id");
    }
  
    //fetch order
    const order = ORDERS[orderId]!;
  
    const filteredOrderIds = activeOrderIds.filter((id) => id != orderId);
  
    //update active order ids
    if(filteredOrderIds.length > 0){
      symbolOrders.set(symbol, filteredOrderIds);
    }
    else{
      symbolOrders.delete(symbol);
    }
  
    delete ORDERS[orderId];
  
    //update order book
    const priceLevel = ORDERBOOK_STORE[symbol]![order.side as SideSpot][order.price]!
  
    if(Number(priceLevel.remainingQuantity) === Number(order.quantity - order.filledQuantity)){
      //if order quantity is equal to orderbook remaining quantity, it implies , last order in orderbook
      delete ORDERBOOK_STORE[symbol]![order.side as SideSpot][order.price];
      removePriceFromOrderbookIndex(symbol, order.price, order.side as SideSpot);

      queueMessageForAdapter({
        messageType:AdapterMessageType.UPDATE,
        entityType:AdapterEntityType.ORDER,
        payload:{
          orderId,
          status:"cancelled"
        }
      })
      pushDirtyPrices(symbol, order.price);

      return ORDERBOOK_STORE
    }
  
    const userOrderId = priceLevel.makerIds[userId]
  
    if(!userOrderId){
      throw new Error("Internal Server Error");
    }
  
    removeOrderIdInMakerIds(symbol, order.side as SideSpot, order.price, userId, orderId);
    
    const orderUsableQty = order.quantity - order.filledQuantity;
  
    ORDERBOOK_STORE[symbol]![order.side as SideSpot][order.price]!.totalQuantity = priceLevel.totalQuantity - orderUsableQty;
    ORDERBOOK_STORE[symbol]![order.side as SideSpot][order.price]!.remainingQuantity = priceLevel.remainingQuantity - orderUsableQty;
  
    queueMessageForAdapter({
      messageType:AdapterMessageType.UPDATE,
      entityType:AdapterEntityType.ORDER,
      payload:{
        orderId,
        status:"cancelled"
      }
    })
    pushDirtyPrices(symbol, order.price);

    return ORDERBOOK_STORE
  } catch (error) {
    console.log(error)
  }
}
