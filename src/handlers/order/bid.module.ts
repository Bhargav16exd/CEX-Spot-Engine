import { incrementUpdateId, ORDERBOOK_STORE, ORDERBOOK_STORE_INDEX, pushOrderIdInMakerIds } from "../../memory/orderbook/orderbook-store.js";
import BALANCE_STORE, { readBalanceStoreUserLockedBalance, readBalanceStoreUserTotalBalance, readBalanceStoreUserTotalStocks, updateBalancesAndStockForBidOrder, updateBalanceStoreUserLockedBalance, updateBalanceStoreUserTotalBalance, updateBalanceStoreUserTotalStocks } from "../../memory/balance/balance-store.js";
import type { OrderBodyType } from "./ask.module.js";
import { AdapterEntityType, AdapterMessageType, OrderType, type SideSpot } from "@cex/shared";
import { actionCreateBid, identifyOrderStatus, settleOrders } from "./utils.js";
import { OrderSide } from "../../types/order.types.js";
import { createOrder, deleteOrder, ORDERS, updateOrderFilledQuantity } from "../../memory/orders/order.js";
import { queueMessageForAdapter } from "../../queue/db-publisher-client.js";
import { pushDirtyPrices } from "../../memory/dirty-prices/dirty-prices.js";


export function hanldeOrderSideBid(body:OrderBodyType):any{

	const {userId, stockSymbol, side, type, price, quantity} = body;

	if(!userId || !stockSymbol || !side || !type || !price || !quantity ){
		throw new Error("Invalid Inputs");
	}

	const userAvailableBalance = readBalanceStoreUserTotalBalance(userId)! - readBalanceStoreUserLockedBalance(userId)!

	if(userAvailableBalance === undefined){
    throw new Error("Internal Server Error");
	}

	if((price * quantity) > userAvailableBalance){
		throw new Error("Insufficiety Balance");
	}

	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].balance["inr"]) return

	if(type == OrderType.limit){
    return hanldeOrderTypeLimit(userId, stockSymbol, OrderSide.bid, type, price, quantity)
	}

	if(type == OrderType.market){
		return handleOrderTypeMarket(userId, stockSymbol, side, type, price, quantity);
	}
}

const hanldeOrderTypeLimit = (userId:string, symbol:string, side:SideSpot, type:OrderType, price:number, quantity:number) => {

  //SAFTEY CHECKS
  if(!ORDERBOOK_STORE[symbol]){
    throw new Error("Internal Server Error");
  }

  //Locking user balance
  const takerPreviousLockedBalance = readBalanceStoreUserLockedBalance(userId);
	updateBalanceStoreUserLockedBalance(userId, (takerPreviousLockedBalance + (quantity * price)));

  const order = createOrder({userId, symbol, side, type, price, quantity});
  const orderId = order.orderId;

  /*
    SCENARIO 1 - USER WANTS TO BUY BUT NO CORRESPONDING ASK WITH SAME PRICE IS AVAILABLE
    ACTION - WE PUT BID IN ORDERBOOK
  */
  const ORDERBOOK_STORE_INDEX_length = ORDERBOOK_STORE_INDEX[symbol]?.ask.length!

  if(!ORDERBOOK_STORE[symbol].ask[price] 
    && 
    (price < ORDERBOOK_STORE_INDEX[symbol]?.ask[0]! || ORDERBOOK_STORE_INDEX_length == 0) 
  ){

    //implies if there alredy exist an ASK then just increment its quantity 
    if(ORDERBOOK_STORE[symbol].bid[price]){
      
      ORDERBOOK_STORE[symbol].bid[price].totalQuantity = ORDERBOOK_STORE[symbol].bid[price].totalQuantity + quantity;
      ORDERBOOK_STORE[symbol].bid[price].remainingQuantity = ORDERBOOK_STORE[symbol].bid[price].remainingQuantity + quantity;

      //push Order Id reference in orderbook
      pushOrderIdInMakerIds(symbol, side, price, userId, orderId);

      //increment updateId 
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
      };
    }
    //if there exist no bid then create one
    else{

      actionCreateBid(userId, symbol, quantity, price, orderId);

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
    SCENARIO 2 - USER WANTS TO BUY && ASK WITH SAME PRICE IS AVAILABLE , depending on quantity available for sale we perform actions
    ACTION - WE PUT BID IN ORDERBOOK OR DELETE WHOLE BID IF REQUIRED
  */

  return handlePriceAvailableForOrderTypeLimit(userId,  symbol, side, type, price, quantity, orderId);
}

const handlePriceAvailableForOrderTypeLimit = (userId:string, stockSymbol:string, side:string, type:string, userPrice:number, quantity:number, orderId:string) => {

	if(!ORDERBOOK_STORE_INDEX[stockSymbol]) return false;
	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].balance["inr"]) return;

	const orderTotalCost = quantity * userPrice;
	let totalCostSpent = 0;

  let finalFilledQuantity = 0;
	let fullFilledQuantity = 0;
	let count = 0

	for(const price of ORDERBOOK_STORE_INDEX[stockSymbol].ask){
		/*
			IF USER GIVEN PRICE IS NOT AVAILABLE IN ORDERBOOK BUT THERE EXIST FEW ASK PRICES THAT ARE LESS THAN 
			BID , consume all till price > userPrice , and create bid for remaining quantity 
		*/
		if(price > userPrice && quantity > fullFilledQuantity){
			const remainingStockToBuy = (quantity - fullFilledQuantity);
      pushDirtyPrices(stockSymbol, price);
			actionCreateBid(userId, stockSymbol, remainingStockToBuy, userPrice, orderId);
			break;
		}


		if(price > userPrice || quantity == fullFilledQuantity){
			//tbd
			break;
		}
		
		//@ts-ignore
		const askInfo = ORDERBOOK_STORE[stockSymbol].ask[price]!

		if(!ORDERBOOK_STORE[stockSymbol] || !ORDERBOOK_STORE[stockSymbol].ask[price]) return false;

		if(askInfo.remainingQuantity == (quantity - fullFilledQuantity)){

			totalCostSpent = totalCostSpent + (askInfo.remainingQuantity * price);
      finalFilledQuantity = finalFilledQuantity + askInfo.remainingQuantity

      //settle makers orders and balances
      const makerIds = askInfo.makerIds;
      settleOrders(makerIds, userId, stockSymbol , (quantity - fullFilledQuantity), orderId);

      //update order of taker
      updateOrderFilledQuantity(orderId, (quantity - fullFilledQuantity));

      //update orderbook
      incrementUpdateId(stockSymbol);

      //delete maker entry
			delete ORDERBOOK_STORE[stockSymbol].ask[price];

      count++;
      pushDirtyPrices(stockSymbol, price);
			break;
		}

		if(askInfo.remainingQuantity > (quantity - fullFilledQuantity)){

      totalCostSpent = totalCostSpent + ((quantity - fullFilledQuantity) * price);
      finalFilledQuantity = finalFilledQuantity + (quantity - fullFilledQuantity)

      //settle orders
      const makerIds = askInfo.makerIds;
      settleOrders(makerIds, userId, stockSymbol , (quantity - fullFilledQuantity), orderId);

      //update order of taker
      updateOrderFilledQuantity(orderId, (quantity - fullFilledQuantity));

			//update order book
			const previousRemainingQuantity = ORDERBOOK_STORE[stockSymbol].ask[price].remainingQuantity;
			ORDERBOOK_STORE[stockSymbol].ask[price].remainingQuantity = previousRemainingQuantity - (quantity - fullFilledQuantity);

      pushDirtyPrices(stockSymbol, price);
			break;
		}

		//update fullfilled quantity
    finalFilledQuantity = finalFilledQuantity + askInfo.remainingQuantity;
		fullFilledQuantity = fullFilledQuantity + askInfo.remainingQuantity;
		totalCostSpent = totalCostSpent + (askInfo.remainingQuantity * price);

    //settle orders
    const makerIds = askInfo.makerIds;
    settleOrders(makerIds, userId, stockSymbol , (quantity - fullFilledQuantity), orderId);

		//delete ask entry from order book
    incrementUpdateId(stockSymbol)
		delete ORDERBOOK_STORE[stockSymbol].ask[price];

		//add bid entry to the order book
		//partial fullfillment of bid order --> implies requested stock amount > available ask
		if(price == userPrice){
			const remainingStockToBuy = (quantity - fullFilledQuantity);
			actionCreateBid(userId, stockSymbol, remainingStockToBuy, price, orderId);
		}

		if(price  == ORDERBOOK_STORE_INDEX[stockSymbol].ask[ORDERBOOK_STORE_INDEX[stockSymbol].ask.length - 1]){
			totalCostSpent = totalCostSpent + ((quantity - fullFilledQuantity) * userPrice);
			const remainingStockToBuy = (quantity - fullFilledQuantity);
			actionCreateBid(userId, stockSymbol, remainingStockToBuy, userPrice, orderId);
		}

    pushDirtyPrices(stockSymbol, price);
		count++;
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

	/*
	 IF ASK EXIST WITH PRICE LESS THAN OR EQUAL TO USER GIVEN PRICE , we lock the limit amount which is greater , so in that scenario
	 we will deduct extra locked balance
	*/
	if(userPrice > ORDERBOOK_STORE_INDEX[stockSymbol]?.ask[0]!){
		updateBalanceStoreUserLockedBalance(userId, (readBalanceStoreUserLockedBalance(userId) - (orderTotalCost - totalCostSpent)));
	}

	while(count > 0){
		ORDERBOOK_STORE_INDEX[stockSymbol].ask.shift();
		count--;
  }

  return {
    totalQuantity:quantity,
    fillQuantity:finalFilledQuantity
  };
}

const handleOrderTypeMarket = (userId:string, stockSymbol:string, side:string, type:string, userPrice:number, quantity:number) => {

	if(!ORDERBOOK_STORE_INDEX[stockSymbol]) return;
	if(!BALANCE_STORE[userId] ||!BALANCE_STORE[userId]?.balance["inr"] || !BALANCE_STORE[userId].stock[stockSymbol]) return;
	if(!ORDERBOOK_STORE[stockSymbol] || !ORDERBOOK_STORE[stockSymbol].ask) return;

	//lock user balance before bid begins

	let fullFilledQuantity = 0;
	let count = 0;

	
	for(const price of ORDERBOOK_STORE_INDEX[stockSymbol].ask){

		if(fullFilledQuantity == quantity){
			break;
		}

		const askInfo = ORDERBOOK_STORE[stockSymbol]?.ask[price]!

		if(!ORDERBOOK_STORE[stockSymbol].ask[price]) return;
	
		if(askInfo.remainingQuantity == (quantity - fullFilledQuantity)){

			//increment full quantity
			fullFilledQuantity = fullFilledQuantity + askInfo.remainingQuantity;

			//delete entity
			delete ORDERBOOK_STORE[stockSymbol]?.ask[price];

			//read user balance and stock
			const userBalanceTotal = readBalanceStoreUserTotalBalance(userId);
			const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!;

			//udpate balance and stocks
			BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal - (askInfo.remainingQuantity * price);
			BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal + askInfo.remainingQuantity;

			//read user balance and stock
			const anuser = askInfo.orders[0]?.userId!
			const anuserBalanceTotal = readBalanceStoreUserTotalBalance(anuser);
			const anuserStocksTotal = readBalanceStoreUserTotalStocks(anuser, stockSymbol)!;

			//@ts-ignore
			BALANCE_STORE[anuser].balance["inr"].total! = anuserBalanceTotal + (askInfo.remainingQuantity * price);
			//@ts-ignore
			BALANCE_STORE[anuser].stock[stockSymbol].total = anuserStocksTotal - askInfo.remainingQuantity;

			count++;
			break;
		}

		if(askInfo.remainingQuantity > (quantity - fullFilledQuantity)){

			//update store
			ORDERBOOK_STORE[stockSymbol].ask[price].remainingQuantity = ORDERBOOK_STORE[stockSymbol].ask[price].remainingQuantity - (quantity - fullFilledQuantity);

			//add order in order book
			ORDERBOOK_STORE[stockSymbol].ask[price].orders.push({
				userId,
				quantity:askInfo.totalQuantity,
				filledQuantity:(quantity - fullFilledQuantity),
				orderId:"1",
				createdAt: new Date().toISOString()
			})

			//read user balance and stocks
			const userBalanceTotal = readBalanceStoreUserTotalBalance(userId);
			const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!;

			//update 
			BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal - ((quantity - fullFilledQuantity) * price);
			BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal + (quantity - fullFilledQuantity);

			break;
		}

		//increment fullfill quantitiy
		fullFilledQuantity = fullFilledQuantity + askInfo.remainingQuantity;

		//delete entity
		delete ORDERBOOK_STORE[stockSymbol]?.ask[price];

		//read user balance and stock
		const userBalanceTotal = readBalanceStoreUserTotalBalance(userId);
		const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!;

		//udpate balance and stocks
		BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal - (askInfo.remainingQuantity * price);
		BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal + askInfo.remainingQuantity;
		count++;
	}

	while(count > 0){
		ORDERBOOK_STORE_INDEX[stockSymbol].ask.shift();
		count--;
	}

	if(count == ORDERBOOK_STORE_INDEX[stockSymbol].ask.length){
		//tbd push in queue
		//return res.json(new HttpSuccessResponse(200, true, `Pratial Order Completed [Remaining Amount] : ${quantity-fullFilledQuantity}`, ORDERBOOK_STORE[stockSymbol]));
	}

	//tbd push in queue
	//return res.json(new HttpSuccessResponse(200, true, "Order Placed", ORDERBOOK_STORE[stockSymbol]));
}