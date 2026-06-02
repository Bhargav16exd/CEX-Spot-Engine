import type { OrderType, SideSpot } from "@cex/shared"

export interface CreateOrderEntityOrderType {
  side:  SideSpot,
  type:OrderType,
	price:number,
	quantity:number,
	userId:string,
  symbol:string,
}