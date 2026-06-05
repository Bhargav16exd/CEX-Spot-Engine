import type { EngineWsMessage } from "@cex/shared";
import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "";

const WS_BROADCAST_QUEUE = "ws-broadcast-queue";

export const wsEventPublisher = createClient({url:REDIS_URL}).on("err",(error)=>{
  console.log("ERROR WHILE CREATING PUBILSHER");
})

export const queueMessageWsServer = async (payload:EngineWsMessage) => {
  await wsEventPublisher.lPush(WS_BROADCAST_QUEUE ,JSON.stringify(payload))
}