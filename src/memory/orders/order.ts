import { MarketType, type OrderEntityType, type OrderStatus } from "@bhargav16exdd/cex";
import type { CreateOrderEntityOrderType } from "./order.types.js";
import { randomUUID } from "crypto";

export const ORDERS : Record<string, OrderEntityType> = {};
export const ACTIVE_ORDERS_INDEX : Map<string, Map<string, Array<string>>> = new Map();

/*
  ORDERS
  {
    "orderId":{ OrderEntityType }
  }
*/

/*  
  ACTIVE_ORDER_INDEX
  {
    "userId":{ 
      "SOL_USDC":["orderId"] 
    }
  }
*/

/*
  ------- ORDER MODFIERS ------
  -----------------------------
*/

export const createOrder = (payload: CreateOrderEntityOrderType) => {

  const orderId = randomUUID();

  const { 
    side,
    type,
    price,
    quantity,
    userId,
    symbol 
  } = payload;

  ORDERS[orderId] = {
    orderId,
    side,
    type,
    price,
    quantity,
    filledQuantity:0,
    status:"open",
    userId,
    symbol,
    market:MarketType.spot
  }

  putUserOrderInIndex(userId, orderId, symbol);

  return ORDERS[orderId]
}

export const updateOrderStatus = (orderId:string, status:OrderStatus) => {
  if(!ORDERS[orderId]) return false;
  ORDERS[orderId].status = status
}

export const updateOrderFilledQuantity = (orderId:string, quantity:number) => {
  if(!ORDERS[orderId]) return;
  ORDERS[orderId].filledQuantity = quantity
}

export const deleteOrder = (orderId:string) => {
  const order = ORDERS[orderId];
  delete ORDERS[orderId];
  removeUserOrderInIndex(order?.userId!, orderId, order?.symbol!);
}

/*
  ------- ACTIVE ORDER INDEX MODFIERS ------
  ------------------------------------------
*/
export const getUserOrderInIndex = (userId:string, orderId:string, symbol:string) => {
  const userOrders = ACTIVE_ORDERS_INDEX.get(userId);

  if(!userOrders){
    return []
  }

  const symbolOrders = userOrders.get(symbol);

  if(!symbolOrders){
    return []
  }

  const activeOrders = symbolOrders.map((id)=>{
    return ORDERS[id]!
  })

  return activeOrders;
}
 
const putUserOrderInIndex = (userId:string, orderId:string, symbol:string) =>{
  let userOrders = ACTIVE_ORDERS_INDEX.get(userId);

  if(!userOrders){
    userOrders = new Map();
    ACTIVE_ORDERS_INDEX.set(userId, userOrders);
  }

  let symbolOrder = userOrders.get(symbol);

  if(!symbolOrder){
    symbolOrder = []
    userOrders.set(symbol, symbolOrder);
  }

  symbolOrder.push(orderId);
}

const removeUserOrderInIndex = (userId:string, orderId:string, symbol:string) => {
  const userOrders = ACTIVE_ORDERS_INDEX.get(userId);

  if(!userOrders){
    return false;
  }

  const symbolOrders = userOrders.get(symbol);

  if(!symbolOrders){
    return false;
  }

  const updatedOrders = symbolOrders.filter((id:string)=> id != orderId);

  if(updatedOrders.length === 0){
    userOrders.delete(symbol);
    return true
    
  }else{
    userOrders.set(symbol, updatedOrders);
    return true
  }
}

const getUserActiveOrdersPaginated = (userId:string, symbol:string, offset:number, count:number) => {


  const userOrders = ACTIVE_ORDERS_INDEX.get(userId);

  if(!userOrders){
    return [];
  }
  
  const symbolOrders = userOrders.get(symbol);

  if(!symbolOrders){
    return []
  }

  let activeOrders = [];
  let counter = 0;

  for(let i = offset ; i < symbolOrders.length && counter < count ; i++ , counter++){
    const id = symbolOrders[i]!;
    activeOrders.push(ORDERS[id]);
  }

  return activeOrders; 
}

/* 
  ------ LOADING BACKUPS IN MEMORY ------
  ---------------------------------------
*/
export const loadOrders = (orderBackup : OrderEntityType, activeOrderIndex : Map<string, Map<string, Array<string>>> ) => {
  Object.assign(ORDERS, orderBackup);

  for(const [userId, symbolMap] of activeOrderIndex.entries()){
    ACTIVE_ORDERS_INDEX.set(userId, 
      new Map( [...symbolMap.entries()].map(([symbol, orderIds])=>[
        symbol,
        [...orderIds]
      ]))
    )
  }
}

/* 
  ------ QUEUE REQUEST HANDLERS ------
  ------------------------------------
*/
export const handle_GET_OPEN_ORDERS_Request = (payload:any) => {
  const { id, symbol, offset, count } = payload;
  const numOffset = Number(offset);
  const numCount = Number(count);

  if(!id){
    throw new Error("Invalid Input");
  }
  return getUserActiveOrdersPaginated(id, symbol, numOffset, numCount);
}