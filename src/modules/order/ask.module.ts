import { addPriceToOrderBookIndex, ORDERBOOK_STORE, ORDERBOOK_STORE_INDEX } from "../../../../engine/src/memory-store/orderbook/orderbook-store.js"
import BALANCE_STORE, { readBalanceStoreUserLockedStocks, readBalanceStoreUserTotalBalance, readBalanceStoreUserTotalStocks, updateBalancesAndStockForAskOrder, updateBalanceStoreUserLockedStocks } from "../../memory-store/balance/balance-store.js";
import { OrderType } from "./bid.module.js"

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
		ORDERBOOK_STORE[stockSymbol] = {
			ask : {},
			bid: {}
		}
	}

	//userAvailableStocks - these are the stocks that can be used further
	const userAvailableStock = readBalanceStoreUserTotalStocks(userId, stockSymbol)! - readBalanceStoreUserLockedStocks(userId, stockSymbol)!

	if(userAvailableStock == 0){
		//tbd
		//user owned stocks are not found in memory 
		//refresh memory
		//retry and throw error
	}

	console.log(userAvailableStock);

	//if user own quantity is less than order throw error
	if(quantity > userAvailableStock){
		//error queue
		console.log("hi")
		throw new Error("Insufficient Quantity");
	}

	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].stock[stockSymbol]){
		//tbd
		return
	}


	if(type == OrderType.LIMIT){

		//before starting order - lock all the stocks that are required for order fullfillment
		const takerPreviousLockedStocks = readBalanceStoreUserLockedStocks(userId, stockSymbol);
		updateBalanceStoreUserLockedStocks(userId, stockSymbol, (takerPreviousLockedStocks + quantity));

		/*
			SCENARIO 1 - USER WANTS TO BUY BUT NO BID IS AVAILABLE
			ACTION - WE PUT ASK IN ORDERBOOK
		*/
		const ORDERBOOK_STORE_INDEX_length = ORDERBOOK_STORE_INDEX[stockSymbol]?.bid.length!

		//if bid for that price doesnt exist , sit in ask side of orderbook
		if(!ORDERBOOK_STORE[stockSymbol]?.bid[price] 
			&&
			(price > ORDERBOOK_STORE_INDEX[stockSymbol]!.bid[ORDERBOOK_STORE_INDEX_length-1]! 
				|| ORDERBOOK_STORE_INDEX_length == 0)
		){			
		
			//implies if there alredy exist an ASK then just increment its quantity 
			if(ORDERBOOK_STORE[stockSymbol].ask[price]){

				ORDERBOOK_STORE[stockSymbol].ask[price].totalQuantity = ORDERBOOK_STORE[stockSymbol].ask[price].totalQuantity + quantity;
				ORDERBOOK_STORE[stockSymbol].ask[price].remainingQuantity = ORDERBOOK_STORE[stockSymbol].ask[price].remainingQuantity + quantity;
				//tbd push in response queue
				return {orderbook:ORDERBOOK_STORE[stockSymbol],balance:BALANCE_STORE};
			}
			//else create a new ask
			else{
				actionCreateAsk(userId, stockSymbol, quantity ,price);
				//tbd push in response queue
				return {orderbook:ORDERBOOK_STORE[stockSymbol],balance:BALANCE_STORE};
			}
		}
		/*
			SCENARIO 2 - USER WANTS TO SELL/ASK && BID IS AVAILABLE , depending on quantity available for sale we perform actions
		  ACTION - WE PUT ASK IN ORDERBOOK OR DELETE WHOLE BID IF REQUIRED
		*/

		return handlePriceAvailableForOrder(userId, stockSymbol, side, type, price, quantity);
	}

	if(type == OrderType.MARKET){
		handleOrderTypeMarket(userId, stockSymbol, side, type , price, quantity);
	}
}

/*
	FUNCTIONS CREATED AS ACTIONS that are performed on ORDER BOOK
*/
const actionCreateAsk = (userId:string , stockSymbol:string, quantity:number, price:number) => {

	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].stock[stockSymbol]){
		return false
	}

	if(!ORDERBOOK_STORE[stockSymbol]){
		return false
	}

	//update orderbook
	ORDERBOOK_STORE[stockSymbol].ask[price] = {
		totalQuantity:quantity,
		remainingQuantity:quantity,
		orders:[{
			userId,
			quantity,
			filledQuantity:0,
			orderId:"1",
			createdAt: new Date().toISOString()
		}]
	}

	//update orderbook index
	addPriceToOrderBookIndex(stockSymbol, "ask", price);

	return true
}

const handlePriceAvailableForOrder = (userId:string, stockSymbol:string, side:string, type:string, userPrice:number, quantity:number) => {

	if(!ORDERBOOK_STORE[stockSymbol]) return;
	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].stock[stockSymbol]) return;
	if(!ORDERBOOK_STORE_INDEX[stockSymbol]?.bid) return;
	let fullFilledQuantity = 0;
	let count = 0;

	const orderTotalCost = quantity * userPrice;
	let totalCostSpent = 0;

	for(let i = ORDERBOOK_STORE_INDEX[stockSymbol].bid.length - 1 ; i >= 0  ; i--){
		
		const price = ORDERBOOK_STORE_INDEX[stockSymbol].bid[i]!;

		if(price < userPrice && fullFilledQuantity != quantity){
			actionCreateAsk(userId, stockSymbol, (quantity - fullFilledQuantity) ,userPrice);
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
			//tbd
			//add entry in db for fills
			delete ORDERBOOK_STORE[stockSymbol].bid[price];

			//partial fullfillment of ask order --> implies requested amount > available bids
			totalCostSpent = totalCostSpent + (bidInfo.remainingQuantity * price);

			updateBalancesAndStockForAskOrder(stockSymbol, userId, bidInfo.orders[0]?.userId!, bidInfo.remainingQuantity, price);
			count++;
			break;
		}

		//complete fullfillment of ask order
		if(bidInfo.remainingQuantity > (quantity - fullFilledQuantity)){

			//reduce quantity in orderbook 
			const previousRemainingQuantity = ORDERBOOK_STORE[stockSymbol].bid[price].remainingQuantity
			ORDERBOOK_STORE[stockSymbol].bid[price].remainingQuantity = previousRemainingQuantity - (quantity - fullFilledQuantity)

			//add order in orderbook
			ORDERBOOK_STORE[stockSymbol].bid[price].orders.push({
				userId,
				quantity:bidInfo.totalQuantity,
				filledQuantity:quantity,
				orderId:"1",
				createdAt: new Date().toISOString()
			})

			totalCostSpent = totalCostSpent + ((quantity - fullFilledQuantity) * price);

			//after all stocks are sold , update user balance and stocks in balance store
			updateBalancesAndStockForAskOrder(stockSymbol, userId, bidInfo.orders[0]?.userId!, (quantity - fullFilledQuantity), price);

			break;
		}

		//update fullfilled quantity
		fullFilledQuantity = fullFilledQuantity + bidInfo.remainingQuantity;

		totalCostSpent = totalCostSpent + (bidInfo.remainingQuantity * price);

		//delete bid entry from order book 
			//tbd add fills db
		delete ORDERBOOK_STORE[stockSymbol].bid[price]


		if(price == userPrice){
			//add ask entry to the order book
			const remainingStocksToSell = (quantity - fullFilledQuantity);
			actionCreateAsk(userId, stockSymbol, remainingStocksToSell, price)
		}

		if(price == ORDERBOOK_STORE_INDEX[stockSymbol].bid[0]){
			//add ask entry to the order book
			const remainingStocksToSell = (quantity - fullFilledQuantity);
			actionCreateAsk(userId, stockSymbol, remainingStocksToSell, userPrice);
		}

		//partial fullfillment of ask order --> implies requested amount > available bids

		/*
			AS PARTIAL STOCKS ARE asked
			-> LOCKED STOCKS ARE HANDLED BY FUNCTION ITSELF
			AND PARTIAL STOCKS ARE SOLD
			-> WE NEED TO UPDATE JUST THE BALANCE AS SALE VALUE
		*/

		//after all stocks are sold , update user balance and stocks in balance store
		updateBalancesAndStockForAskOrder(stockSymbol, userId, bidInfo.orders[0]?.userId!, bidInfo.remainingQuantity, price);

		count++;
	}

	while(count > 0){
		ORDERBOOK_STORE_INDEX[stockSymbol].bid.pop();
		count--;
	}
	//tbd push in response queue
	return {orderbook:ORDERBOOK_STORE[stockSymbol],balance:BALANCE_STORE};
}

const handleOrderTypeMarket = (userId:string, stockSymbol:string, side:string, type:string, userPrice:number, quantity:number) => {

	if(!ORDERBOOK_STORE_INDEX[stockSymbol]) return;
	if(!ORDERBOOK_STORE[stockSymbol]) return;
	if(!BALANCE_STORE[userId] || !BALANCE_STORE[userId].balance["inr"] || !BALANCE_STORE[userId].stock[stockSymbol]) return
	
	let fullFilledQuantity = 0;
	let count = 0;

	for(let i = ORDERBOOK_STORE_INDEX[stockSymbol].bid.length - 1 ; i >= 0  ; i--){

		if(fullFilledQuantity == quantity){
			break;
		}

		//get highest price bid from index 
		const price = ORDERBOOK_STORE_INDEX[stockSymbol].bid[i]!;

		if(!ORDERBOOK_STORE[stockSymbol].bid[price]) return;

		//based on price recived -> fetch full order details
		const bidInfo = ORDERBOOK_STORE[stockSymbol].bid[price]!

		if(bidInfo.remainingQuantity == (quantity - fullFilledQuantity)){
			
			//add bid quantity 
			fullFilledQuantity = fullFilledQuantity + bidInfo.remainingQuantity

			//delete that bid from order book
			delete ORDERBOOK_STORE[stockSymbol].bid[price]

			//now as order is proccessed read user stock and balance && update user stock and balance
			//read
			const userBalanceTotal = readBalanceStoreUserTotalBalance(userId)
			const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!

			//update
			BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal + (price * bidInfo.remainingQuantity);
			BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal - bidInfo.remainingQuantity;
			count++;
			break;
		}

		if(bidInfo.remainingQuantity > (quantity - fullFilledQuantity)){
			//update store
			ORDERBOOK_STORE[stockSymbol].bid[price].remainingQuantity = bidInfo.remainingQuantity - (quantity - fullFilledQuantity);

			//add order 
			ORDERBOOK_STORE[stockSymbol].bid[price].orders.push({
				userId,
				quantity:bidInfo.totalQuantity,
				filledQuantity:(quantity - fullFilledQuantity),
				orderId:"1",
				createdAt: new Date().toISOString()
			})

			//read and update balances and stock of user

			//read
			const userBalanceTotal = readBalanceStoreUserTotalBalance(userId);
			const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!;

			//update
			BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal + (price * (quantity - fullFilledQuantity));
			BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal - (quantity - fullFilledQuantity);

			break;
		}

		/*
			SECTION HANLDES THAT , IF A SINGLE BID IS NOT ABLE TO FULL FILL THEN BELOW HAPPENS
		*/
		//add bid quantity 
		fullFilledQuantity = fullFilledQuantity + bidInfo.remainingQuantity

		//delete that bid from order book
		delete ORDERBOOK_STORE[stockSymbol].bid[price]

		//now as order is proccessed read user stock and balance && update user stock and balance
		//read
		const userBalanceTotal = readBalanceStoreUserTotalBalance(userId)
		const userStocksTotal = readBalanceStoreUserTotalStocks(userId, stockSymbol)!

		//update
		BALANCE_STORE[userId].balance["inr"].total = userBalanceTotal + (price * bidInfo.remainingQuantity);
		BALANCE_STORE[userId].stock[stockSymbol].total = userStocksTotal - bidInfo.remainingQuantity;
		count ++;
	}

	while(count > 0){
		ORDERBOOK_STORE_INDEX[stockSymbol].bid.pop();
		count --;
	}

	if(count == ORDERBOOK_STORE_INDEX[stockSymbol].bid.length){
		//tbd push in response queue
		//return res.json(new HttpSuccessResponse(200, true, `Pratial Order Completed [Remaining Amount] : ${quantity-fullFilledQuantity}`, ORDERBOOK_STORE[stockSymbol]));
	}

	//tbd push in response queue
	//return res.json(new HttpSuccessResponse(200, true, "Order Placed", ORDERBOOK_STORE[stockSymbol]));
}
