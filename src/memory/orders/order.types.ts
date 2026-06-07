import type { OrderType, SideSpot } from "@bhargav16exdd/cex"

export interface CreateOrderEntityOrderType {
  side:  SideSpot,
  type:OrderType,
	price:number,
	quantity:number,
	userId:string,
  symbol:string,
}