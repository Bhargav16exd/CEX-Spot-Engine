import { handleCreateOrderEntityRequest } from "../../memory-store/orderbook/orderbook-store.js";
import type { EngineRequestType } from "../../types/engine-types.js";
import { hanldeOrderSideAsk } from "../order/ask.module.js";
import { hanldeOrderSideBid } from "../order/bid.module.js";

enum EngineCommand {
  CREATE_ORDER = "create_order",
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
}

export default engineRequestHandler;