import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "";

//publisher which will send back responses
export const publisher = createClient({url:REDIS_URL}).on("error", (error)=>{
  console.log("ERROR WHILE CREATING PUBLISHER");
})

//subscriber which will listen request
export const subscriber = createClient({url:REDIS_URL}).on("error", (error)=>{
   console.log("ERROR WHILE CREATING SUBSRIBER");
})

export const connectRedis = async ():Promise<void> => {
  await Promise.all([publisher.connect(), subscriber.connect()]);
}

const pingRedis = () => {
  return publisher.ping();
}

