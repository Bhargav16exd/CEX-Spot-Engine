import { hanldeOrderSideAsk } from "../handlers/order/ask.module.js";
import { hanldeOrderSideBid } from "../handlers/order/bid.module.js";
import { hanldeUserBalanceUpdate } from "../memory/balance/balance-store.js";
import { handleCreateOrderEntityRequest } from "../memory/orderbook/orderbook-store.js";
import type { EngineRequestType } from "../types/engine-types.js";

enum EngineCommand {
  CREATE_ORDER = "create_order",
  UPDATE_BALANCE = "update_balance",
  GET_DEPTH = "get_depth",
  GET_USER_BALANCE = "get_user_balance",
  GET_ORDER = "get_order",
  CANCEL_ORDER = "cancel_order",
  CREATE_STOCK_ENTITY = "create_stock_entity"
}

export enum OrderSide {
	ASK = "ASK",
	BID = "BID"
}

function engineRequestHandler(request:EngineRequestType){

    const messageType = request.type

    if(messageType == EngineCommand.CREATE_ORDER){
      if(request.payload.side == OrderSide.ASK){	
        return hanldeOrderSideAsk(request.payload as any);
      }
      if(request.payload.side == OrderSide.BID){
        return hanldeOrderSideBid(request.payload as any);
      }
      
    }
    if(messageType == EngineCommand.CREATE_STOCK_ENTITY){
      return handleCreateOrderEntityRequest(request.payload as any)
    }

    if(messageType == EngineCommand.UPDATE_BALANCE){
      return hanldeUserBalanceUpdate(request.payload);
    }
}

export default engineRequestHandler;