import { EngineCommandEnum, type EngineRequestType } from "@cex/shared";
import { hanldeOrderSideAsk } from "../handlers/order/ask.module.js";
import { hanldeOrderSideBid } from "../handlers/order/bid.module.js";
import { hanldeUserBalanceUpdate } from "../memory/balance/balance-store.js";
import { handleCreateOrderEntityRequest } from "../memory/orderbook/orderbook-store.js";
import { OrderSide } from "../types/order.types.js";


function engineRequestHandler(request:EngineRequestType){

    const messageType = request.type

    if(messageType == EngineCommandEnum.CREATE_ORDER){
      if(request.payload.side == OrderSide.ask){	
        return hanldeOrderSideAsk(request.payload as any);
      }
      if(request.payload.side == OrderSide.bid){
        return hanldeOrderSideBid(request.payload as any);
      }
      
    }
    if(messageType == EngineCommandEnum.CREATE_STOCK_ENTITY){
      return handleCreateOrderEntityRequest(request.payload as any)
    }

    if(messageType == EngineCommandEnum.UPDATE_BALANCE){
      return hanldeUserBalanceUpdate(request.payload);
    }
}

export default engineRequestHandler;