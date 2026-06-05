import { DIRTY_ORDERBOOK_PRICES } from "../../memory/dirty-prices/dirty-prices.js";
import { ORDERBOOK_STORE } from "../../memory/orderbook/orderbook-store.js";
import { queueMessageWsServer } from "../../queue/ws-publisher-client.js";

const PUBLISH_DIRTY_PRICES_INTERVAL = 100;

export const publishDirtyPrices = () => {
  
  setInterval(()=>{

    for(const symbol of Object.keys(DIRTY_ORDERBOOK_PRICES)){

      const updateId = ORDERBOOK_STORE[symbol]!.updateId;
      const SNAPSHOT_ORDERBOOK_STATE = ORDERBOOK_STORE[symbol];
      const SNAPSHOT_DIRTY_ORDERBOOK_PRICES_STATE = DIRTY_ORDERBOOK_PRICES[symbol];

      const priceSet = SNAPSHOT_DIRTY_ORDERBOOK_PRICES_STATE;

      if(!priceSet || priceSet.size == 0) continue;

      const bidsPayload: [string, string][] = [];
      const asksPayload: [string, string][] = [];

      for(const price of priceSet){

        const bidLevel = SNAPSHOT_ORDERBOOK_STATE?.bid[price];
        const bidQty = bidLevel ? bidLevel.remainingQuantity : 0;

        const askLevel = SNAPSHOT_ORDERBOOK_STATE?.ask[price];
        const askQty = askLevel ? askLevel.remainingQuantity : 0;
      
        bidsPayload.push([price.toString(), bidQty.toString()]);
        asksPayload.push([price.toString(), askQty.toString()]);
      }

      queueMessageWsServer({
        topic:`spot-${symbol}`,
        bids:bidsPayload,
        asks:asksPayload,
        updateId
      })

      priceSet.clear();
    }

  }, PUBLISH_DIRTY_PRICES_INTERVAL )
}