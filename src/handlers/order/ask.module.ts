import { addPriceToOrderBookIndex, incrementUpdateId, ORDERBOOK_STORE, ORDERBOOK_STORE_INDEX, pushOrderIdInMakerIds } from "../../memory/orderbook/orderbook-store.js"
import BALANCE_STORE, { readBalanceStoreUserLockedStocks, readBalanceStoreUserTotalBalance, readBalanceStoreUserTotalStocks, updateBalancesAndStockForAskOrder, updateBalanceStoreUserLockedStocks } from "../../memory/balance/balance-store.js";
import { AdapterEntityType, AdapterMessageType, OrderType, type SideSpot } from "@bhargav16exdd/cex";
import { actionCreateAsk, identifyOrderStatus, settleOrders } from "./utils.js";
import { ACTIVE_ORDERS_INDEX, createOrder, deleteOrder, ORDERS, updateOrderFilledQuantity } from "../../memory/orders/order.js";
import { queueMessageForAdapter } from "../../queue/db-publisher-client.js";
import { pushDirtyPrices } from "../../memory/dirty-prices/dirty-prices.js";

export type OrderBodyType = {
	userId:string,
	stockSymbol:string,
	side:string,
	type:string,
	price:number,
	quantity:number
}

export function hanldeOrderSideAsk(body:OrderBodyType):any{

	const {userId, stockSymbol, side, type, price, quantity} = body;

	if(!userId || !stockSymbol || !side || !type || !price || !quantity ){
		throw new Error("Invalid Inputs");
	}

	//if that stock doesnt exist in order book create an entry for that
	if(!ORDERBOOK_STORE[stockSymbol]){
    return false
	}

	//userAvailableStocks - these are the stocks that can be used further
	const userAvailableStock = readBalanceStoreUserTotalStocks(userId, stockSymbol)! - readBalanceStoreUserLockedStocks(userId, stockSymbol)!

	if(userAvailableStock === undefined){
    throw new Error("Internal Server Error");
	}
  
	//if user own quantity is less than order throw error
	if(quantity > userAvailableStock){
		//error queue
		throw new Error("Insufficient Quantity");
	}

	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].stock[stockSymbol]){
    throw("Internal Server Error");
	}


	if(type == OrderType.limit){
    return handleOrderTypeLimit(userId, stockSymbol, "ask", OrderType.limit, price, quantity)
	}

	if(type == OrderType.market){
		// return handleOrderTypeMarket(userId, stockSymbol, side, type , price, quantity);
	}
}

const handleOrderTypeLimit = (userId:string, symbol:string, side:SideSpot, type:OrderType, price:number, quantity:number) => {

  //SAFETY CHECKS
  if(!ORDERBOOK_STORE[symbol]){
    throw new Error("Internal Server Error");
	}

  //before starting order - lock all the stocks that are required for order fullfillment
  const takerPreviousLockedStocks = readBalanceStoreUserLockedStocks(userId, symbol)!;
  updateBalanceStoreUserLockedStocks(userId, symbol, (takerPreviousLockedStocks + quantity));

  const order = createOrder({userId, symbol, side, type, price, quantity});
  const orderId = order.orderId;

  /*
    SCENARIO 1 - USER WANTS TO BUY BUT NO BID IS AVAILABLE
    ACTION - WE PUT ASK IN ORDERBOOK
  */
  const ORDERBOOK_STORE_INDEX_length = ORDERBOOK_STORE_INDEX[symbol]?.bid.length!

  //if bid for that price doesnt exist , sit in ask side of orderbook
  if(!ORDERBOOK_STORE[symbol]?.bid[price] 
    &&
    (price > ORDERBOOK_STORE_INDEX[symbol]!.bid[ORDERBOOK_STORE_INDEX_length-1]! 
      || ORDERBOOK_STORE_INDEX_length == 0)
  ){			
  

    //implies if there alredy exist an ASK then just increment its quantity 
    if(ORDERBOOK_STORE[symbol].ask[price]){
      ORDERBOOK_STORE[symbol].ask[price].totalQuantity = ORDERBOOK_STORE[symbol].ask[price].totalQuantity + quantity;
      ORDERBOOK_STORE[symbol].ask[price].remainingQuantity = ORDERBOOK_STORE[symbol].ask[price].remainingQuantity + quantity;

      pushOrderIdInMakerIds(symbol, side, price, userId, orderId);

      incrementUpdateId(symbol);

      queueMessageForAdapter({
        messageType:AdapterMessageType.INSERT,
        entityType:AdapterEntityType.ORDER,
        payload:order
      })

      pushDirtyPrices(symbol, price);

      return {
        totalQuantity:quantity,
        fillQuantity:0
      }
    }
    //else create a new ask
    else{
      actionCreateAsk(userId, symbol, quantity ,price, orderId);

      queueMessageForAdapter({
        messageType:AdapterMessageType.INSERT,
        entityType:AdapterEntityType.ORDER,
        payload:order
      })
      
      pushDirtyPrices(symbol, price);

      return {
        totalQuantity:quantity,
        fillQuantity:0
      };
    }
  }

  /*
    SCENARIO 2 - USER WANTS TO SELL/ASK && BID IS AVAILABLE , depending on quantity available for sale we perform actions
    ACTION - WE PUT ASK IN ORDERBOOK OR DELETE WHOLE BID IF REQUIRED
  */

  return handlePriceAvailableForOrder(userId, symbol, side, type, price, quantity, orderId);

}

const handlePriceAvailableForOrder = (userId:string, stockSymbol:string, side:string, type:string, userPrice:number, quantity:number, orderId:string) => {

	if(!ORDERBOOK_STORE[stockSymbol]) return;
	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].stock[stockSymbol]) return;
	if(!ORDERBOOK_STORE_INDEX[stockSymbol]?.bid) return;
	
  let finalFilledQuantity = 0;
  let fullFilledQuantity = 0;
	let count = 0;

	const orderTotalCost = quantity * userPrice;
	let totalCostSpent = 0;

	for(let i = ORDERBOOK_STORE_INDEX[stockSymbol].bid.length - 1 ; i >= 0  ; i--){
		
		const price = ORDERBOOK_STORE_INDEX[stockSymbol].bid[i]!;

		if(price < userPrice && fullFilledQuantity != quantity){
      pushDirtyPrices(stockSymbol, price);
			actionCreateAsk(userId, stockSymbol, (quantity - fullFilledQuantity) ,userPrice, orderId);
			break;
		}

		if( price < userPrice || fullFilledQuantity == quantity){
			break;
		}
		
		const bidInfo = ORDERBOOK_STORE[stockSymbol].bid[price]

		if(!bidInfo) return
		if(!ORDERBOOK_STORE[stockSymbol] || !ORDERBOOK_STORE[stockSymbol].bid[price]) return;

		//complete fullfillment of ask order
		if(bidInfo.remainingQuantity == (quantity - fullFilledQuantity)){

      //partial fullfillment of ask order --> implies requested amount > available bids
			totalCostSpent = totalCostSpent + (bidInfo.remainingQuantity * price);
      finalFilledQuantity = finalFilledQuantity + bidInfo.remainingQuantity

      //settle makers
      const makerIds = bidInfo.makerIds
      settleOrders(makerIds, userId, stockSymbol, bidInfo.remainingQuantity, orderId)

      //update order
      updateOrderFilledQuantity(orderId, (quantity - fullFilledQuantity));
	
      //update orderbook
      incrementUpdateId(stockSymbol);
      
      //add entry in db for fills
			delete ORDERBOOK_STORE[stockSymbol].bid[price];
	
      pushDirtyPrices(stockSymbol, price);
			count++;
			break;
		}

		//complete fullfillment of ask order
		if(bidInfo.remainingQuantity > (quantity - fullFilledQuantity)){

      totalCostSpent = totalCostSpent + ((quantity - fullFilledQuantity) * price);
      finalFilledQuantity = finalFilledQuantity +  (quantity - fullFilledQuantity);

      //update makers
      const makerIds = bidInfo.makerIds
      settleOrders(makerIds, userId, stockSymbol, (quantity - fullFilledQuantity), orderId);

      //update taker order
      updateOrderFilledQuantity(orderId, (quantity - fullFilledQuantity));


			//reduce quantity in orderbook 
      incrementUpdateId(stockSymbol);
			const previousRemainingQuantity = ORDERBOOK_STORE[stockSymbol].bid[price].remainingQuantity
			ORDERBOOK_STORE[stockSymbol].bid[price].remainingQuantity = previousRemainingQuantity - (quantity - fullFilledQuantity)

      pushDirtyPrices(stockSymbol, price);
			break;
		}

		//update fullfilled quantity
    finalFilledQuantity = finalFilledQuantity + bidInfo.remainingQuantity;
		fullFilledQuantity = fullFilledQuantity + bidInfo.remainingQuantity;
		totalCostSpent = totalCostSpent + (bidInfo.remainingQuantity * price);

    //settle makers
    const makerIds = bidInfo.makerIds
    settleOrders(makerIds, userId, stockSymbol, bidInfo.remainingQuantity, orderId);


		//delete bid entry from order book 
    incrementUpdateId(stockSymbol);
		delete ORDERBOOK_STORE[stockSymbol].bid[price]


		if(price == userPrice){
			//add ask entry to the order book
			const remainingStocksToSell = (quantity - fullFilledQuantity);
			actionCreateAsk(userId, stockSymbol, remainingStocksToSell, price, orderId)
		}

		if(price == ORDERBOOK_STORE_INDEX[stockSymbol].bid[0]){
			//add ask entry to the order book
			const remainingStocksToSell = (quantity - fullFilledQuantity);
			actionCreateAsk(userId, stockSymbol, remainingStocksToSell, userPrice, orderId);
		}

    pushDirtyPrices(stockSymbol, price);
		count++;
	}

	while(count > 0){
		ORDERBOOK_STORE_INDEX[stockSymbol].bid.pop();
		count--;
	}

  const order = ORDERS[orderId]!
  let messageType = AdapterMessageType.INSERT;
  
  order.status = identifyOrderStatus(quantity, finalFilledQuantity)!;

  if(order.status === "closed"){
    deleteOrder(orderId);
    messageType = AdapterMessageType.APPEND_ONLY
  }

  queueMessageForAdapter({
    messageType,
    entityType:AdapterEntityType.ORDER,
    payload:order
  })

  return {
    totalQuantity:quantity,
    fillQuantity:finalFilledQuantity
  };
}

// const handleOrderTypeMarket = (userId:string, stockSymbol:string, side:string, type:string, userPrice:number, quantity:number) => {

// 	if(!ORDERBOOK_STORE_INDEX[stockSymbol]) return;
// 	if(!ORDERBOOK_STORE[stockSymbol]) return;
// 	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].balance["inr"] || !BALANCE_STORE[userId].stock[stockSymbol]) return
	
// 	let fullFilledQuantity = 0;
// 	let count = 0;

// 	for(let i = ORDERBOOK_STORE_INDEX[stockSymbol].bid.length - 1 ; i >= 0  ; i--){

// 		if(fullFilledQuantity == quantity){
// 			break;
// 		}

// 		//get highest price bid from index 
// 		const price = ORDERBOOK_STORE_INDEX[stockSymbol].bid[i]!;

// 		if(!ORDERBOOK_STORE[stockSymbol].bid[price]) return;

// 		//based on price recived -> fetch full order details
// 		const bidInfo = ORDERBOOK_STORE[stockSymbol].bid[price]!

// 		if(bidInfo.remainingQuantity == (quantity - fullFilledQuantity)){
			
// 			//add bid quantity 
// 			fullFilledQuantity = fullFilledQuantity + bidInfo.remainingQuantity

// 			//delete that bid from order book
// 			delete ORDERBOOK_STORE[stockSymbol].bid[price]

// 			//now as order is proccessed read user stock and balance && update user stock and balance
// 			//read
// 			const userBalanceTotal = readBalanceStoreUserTotalBalance(userId)
// 			const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!

// 			//update
// 			BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal + (price * bidInfo.remainingQuantity);
// 			BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal - bidInfo.remainingQuantity;
// 			count++;
// 			break;
// 		}

// 		if(bidInfo.remainingQuantity > (quantity - fullFilledQuantity)){
// 			//update store
// 			ORDERBOOK_STORE[stockSymbol].bid[price].remainingQuantity = bidInfo.remainingQuantity - (quantity - fullFilledQuantity);

// 			//add order 
// 			ORDERBOOK_STORE[stockSymbol].bid[price].orders.push({
// 				userId,
// 				quantity:bidInfo.totalQuantity,
// 				filledQuantity:(quantity - fullFilledQuantity),
// 				orderId:"1",
// 				createdAt: new Date().toISOString()
// 			})

// 			//read and update balances and stock of user

// 			//read
// 			const userBalanceTotal = readBalanceStoreUserTotalBalance(userId);
// 			const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!;

// 			//update
// 			BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal + (price * (quantity - fullFilledQuantity));
// 			BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal - (quantity - fullFilledQuantity);

// 			break;
// 		}

// 		/*
// 			SECTION HANLDES THAT , IF A SINGLE BID IS NOT ABLE TO FULL FILL THEN BELOW HAPPENS
// 		*/
// 		//add bid quantity 
// 		fullFilledQuantity = fullFilledQuantity + bidInfo.remainingQuantity

// 		//delete that bid from order book
// 		delete ORDERBOOK_STORE[stockSymbol].bid[price]

// 		//now as order is proccessed read user stock and balance && update user stock and balance
// 		//read
// 		const userBalanceTotal = readBalanceStoreUserTotalBalance(userId)
// 		const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!

// 		//update
// 		BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal + (price * bidInfo.remainingQuantity);
// 		BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal - bidInfo.remainingQuantity;
// 		count ++;
// 	}

// 	while(count > 0){
// 		ORDERBOOK_STORE_INDEX[stockSymbol].bid.pop();
// 		count --;
// 	}

// 	if(count == ORDERBOOK_STORE_INDEX[stockSymbol].bid.length){
// 		//tbd push in response queue
// 		//return res.json(new HttpSuccessResponse(200, true, `Pratial Order Completed [Remaining Amount] : ${quantity-fullFilledQuantity}`, ORDERBOOK_STORE[stockSymbol]));
// 	}

// 	//tbd push in response queue
// 	//return res.json(new HttpSuccessResponse(200, true, "Order Placed", ORDERBOOK_STORE[stockSymbol]));
// }
