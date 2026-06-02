import { AdapterEntityType, AdapterMessageType, MarketType } from "@cex/shared";
import BALANCE_STORE, { updateBalancesAndStockForAskOrder, updateBalancesAndStockForBidOrder } from "../../memory/balance/balance-store.js";
import { addPriceToOrderBookIndex, incrementUpdateId, ORDERBOOK_STORE, pushOrderIdInMakerIds, removeOrderIdInMakerIds } from "../../memory/orderbook/orderbook-store.js";
import { deleteOrder, ORDERS, updateOrderFilledQuantity, updateOrderStatus } from "../../memory/orders/order.js";
import { queueMessageForAdapter } from "../../queue/db-publisher-client.js";

/*
	FUNCTIONS CREATED AS ACTIONS that are performed on ORDER BOOK
*/
export const actionCreateAsk = (userId:string , stockSymbol:string, quantity:number, price:number, orderId:string) => {

	if(!ORDERBOOK_STORE[stockSymbol]){
		return false
	}

	//update orderbook
	ORDERBOOK_STORE[stockSymbol].ask[price] = {
		totalQuantity:quantity,
		remainingQuantity:quantity,
    makerIds:{},
    takerIds:{}
	}

  //push order id in maker Ids
  pushOrderIdInMakerIds(stockSymbol, "ask", price, userId, orderId);

  //increment updateId 
  incrementUpdateId(stockSymbol);

	//update orderbook index
	addPriceToOrderBookIndex(stockSymbol, "ask", price);

	return true
}

export const actionCreateBid = (userId:string , stockSymbol:string, quantity:number, price:number, orderId:string) => {

	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].balance["inr"]){
		//tbd
		return false
	}

	if(!ORDERBOOK_STORE[stockSymbol]){
		//tbd
		return false
	}

	//update orderbook
	ORDERBOOK_STORE[stockSymbol].bid[price] = {
		totalQuantity:quantity,
		remainingQuantity:quantity,
    makerIds:{},
    takerIds:{}
	}

  //push order id in maker Ids
  pushOrderIdInMakerIds(stockSymbol, "bid", price, userId, orderId);

  //increment updateId 
  incrementUpdateId(stockSymbol);

	//update orderbook index
	addPriceToOrderBookIndex(stockSymbol, "bid", price);

	return true
}

/*
  SKIM THROUGH ORDERBOOK , UPDATE ORDER STATUS AND FILLED QUANTITY
  PUSH THEM TO QUEUE 
  DELETE ORDERS
  REMOVE MAKER IDS FROM ORDER BOOK
*/
export const settleOrders = (makerIds:Record<string, Array<string>>, takerId:string, symbol:string, quantity:number, takerOrderId:string) => {

  let filledQuantity = 0 ;
  const takerOrder = ORDERS[takerOrderId]

  for(const userId in makerIds){

    for(const makerOrderId of makerIds[userId]!){

      if(filledQuantity == quantity){
        break;
      }

      const order = ORDERS[makerOrderId];
      const availableQty = order!.quantity! - order!.filledQuantity!

      if(availableQty <= (quantity - filledQuantity)){  
    
        filledQuantity = filledQuantity + availableQty;

        if(takerOrder?.side === "bid"){
          updateBalancesAndStockForBidOrder(symbol, takerId, userId, availableQty, order!.price); 
          removeOrderIdInMakerIds(symbol, "ask", order!.price, userId, makerOrderId);
        }
        else if(takerOrder?.side === "ask"){
          updateBalancesAndStockForAskOrder(symbol, takerId, userId, availableQty, order!.price); 
          removeOrderIdInMakerIds(symbol, "bid", order!.price, userId, makerOrderId);
        }

        //push fill to queue
        queueMessageForAdapter({
          entityType:AdapterEntityType.FILL,
          messageType:AdapterMessageType.APPEND_ONLY,
          payload:{
            makerSide:order?.side,
            takerSide:takerOrder?.side,
            makerID:userId,
            takerID:takerId,
            makerOrderID:makerOrderId,
            takerOrderID:takerOrderId,
            quantity:availableQty,
            symbol:order?.symbol,
            market:MarketType.spot,
            price:order?.price
          }
        })

        queueMessageForAdapter({
          messageType:AdapterMessageType.UPDATE,
          entityType:AdapterEntityType.ORDER,
          payload:{
            orderId:makerOrderId,
            quantity:order!.quantity,
            status:"closed"
          }
        })

        //push order to queue
        deleteOrder(makerOrderId);

      }
      else{

        if(takerOrder?.side === "bid"){
          updateBalancesAndStockForBidOrder(symbol, takerId, userId, (quantity - filledQuantity), order!.price); 
        }
        else if(takerOrder?.side === "ask"){
          updateBalancesAndStockForAskOrder(symbol, takerId, userId, (quantity - filledQuantity), order!.price); 
        }
        
        //update maker orders qty and status
        updateOrderFilledQuantity(makerOrderId, order!.filledQuantity + (quantity - filledQuantity))
        updateOrderStatus(makerOrderId, "partialfill");

        //push fill to queue
        queueMessageForAdapter({
          entityType:AdapterEntityType.FILL,
          messageType:AdapterMessageType.APPEND_ONLY,
          payload:{
            makerSide:order?.side,
            takerSide:takerOrder?.side,
            makerID:userId,
            takerID:takerId,
            makerOrderID:makerOrderId,
            takerOrderID:takerOrderId,
            quantity:(quantity - filledQuantity),
            symbol:order?.symbol,
            market:MarketType.spot,
            price:order?.price
          }
        })

        queueMessageForAdapter({
          messageType:AdapterMessageType.UPDATE,
          entityType:AdapterEntityType.ORDER,
          payload:{
            orderId:makerOrderId,
            quantity:(quantity - filledQuantity),
            status:"partialfill"
          }
        })

        filledQuantity = filledQuantity + (quantity - filledQuantity);
      }

    }
  }
}

export const identifyOrderStatus = (inputQuantity:number, fullfilledquantity:number) => {
  if(inputQuantity === fullfilledquantity){
    return "closed"
  }
  else if(inputQuantity > fullfilledquantity){
    return "partialfill"
  }
}