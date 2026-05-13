import { dot } from "node:test/reporters";
import { connectRedis, publisher, subscriber } from "./modules/queue/queue-client.js";
import engineRequestHandler from "./modules/request-handler/request-hanlder.js";
import type { EngineRequestType, EngineResponseType } from "./types/engine-types.js";
import dotenv from "dotenv"

dotenv.config()

//connect redis
connectRedis();

const ENGINE_REQUEST_QUEUE = `engine-request-queue`;

const sendResponse = async (queue:string, payload:EngineResponseType) => {
	console.log("got res to send",payload)
	await publisher.lPush(queue, JSON.stringify(payload));
}

//process request
for(;;){

	const entity = await subscriber.brPop(ENGINE_REQUEST_QUEUE, 5);

	console.log(entity)
	if(!entity) continue;

	const parsedRequest = JSON.parse(entity.element) as EngineRequestType;

	console.log("REQUEST RECIEVED",parsedRequest);

	try {
		const engineResponse = engineRequestHandler(parsedRequest);

		const payload : EngineResponseType = {
			transactionId:parsedRequest.transactionId,
			ok:true,
			data:engineResponse
		}

		await sendResponse(parsedRequest.responseQueue, payload);
	} catch (error) {
		await sendResponse(parsedRequest.responseQueue,{
			transactionId:parsedRequest.transactionId,
			ok:false,
			error: error instanceof Error ? error.message : "engine_error"
		})
	}
}

