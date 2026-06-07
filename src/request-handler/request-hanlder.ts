import { EngineCommandEnum, type EngineRequestType } from "@bhargav16exdd/cex";
import { hanldeOrderSideAsk } from "../handlers/order/ask.module.js";
import { hanldeOrderSideBid } from "../handlers/order/bid.module.js";
import { handle_GET_USER_BALANCE_Request, handle_GET_USER_STOCK_QUANTITY_Request, handle_INIT_USER_BALANCE_Request, handle_UPDATE_USER_BALANCE_Request, handle_UPDATE_USER_STOCK_Request } from "../memory/balance/balance-store.js";
import { handle_CANCEL_ORDER_Request, handle_GET_DEPTH_Request, handleCreateOrderEntityRequest} from "../memory/orderbook/orderbook-store.js";
import { OrderSide } from "../types/order.types.js";
import { handle_GET_OPEN_ORDERS_Request } from "../memory/orders/order.js";


function engineRequestHandler(request:EngineRequestType){

    const messageType = request.type;

    /*
      ------- USER REQUEST HANLDER -------- 
      -------------------------------------
    */ 

    if(messageType === EngineCommandEnum.INIT_USER_BALANCE){
      return handle_INIT_USER_BALANCE_Request(request.payload);
    }

    if(messageType === EngineCommandEnum.UPDATE_USER_BALANCE){
      return handle_UPDATE_USER_BALANCE_Request(request.payload);
    }

    if(messageType === EngineCommandEnum.GET_USER_BALANCE){
      return handle_GET_USER_BALANCE_Request(request.payload);
    }

    if(messageType === EngineCommandEnum.UPDATE_USER_STOCK){
      return handle_UPDATE_USER_STOCK_Request(request.payload);
    }

    if(messageType === EngineCommandEnum.GET_USER_STOCK_QUANTITY){
      return handle_GET_USER_STOCK_QUANTITY_Request(request.payload);
    }

    /*
      ------- ORDER REQUEST HANLDER -------- 
      -------------------------------------
    */ 


    if(messageType == EngineCommandEnum.CREATE_ORDER){
      if(request.payload.side == OrderSide.ask){	
        return hanldeOrderSideAsk(request.payload as any);
      }
      if(request.payload.side == OrderSide.bid){
        return hanldeOrderSideBid(request.payload as any);
      }  
    }

    if(messageType == EngineCommandEnum.GET_DEPTH){
      return handle_GET_DEPTH_Request(request.payload as any);
    }

    if(messageType == EngineCommandEnum.GET_OPEN_ORDERS){
     return handle_GET_OPEN_ORDERS_Request(request.payload);
    }

    if(messageType == EngineCommandEnum.CANCEL_ORDER){
      return handle_CANCEL_ORDER_Request(request.payload);
    }


    if(messageType == EngineCommandEnum.CREATE_STOCK_ENTITY){
      return handleCreateOrderEntityRequest(request.payload as any)
    }
}

export default engineRequestHandler;