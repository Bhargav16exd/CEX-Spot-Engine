import type { EngineRequestType, EngineResponseType } from "@cex/shared";
import { connectRedis, publisher, subscriber } from "./queue/queue-client.js";
import engineRequestHandler from "./request-handler/request-hanlder.js";
import dotenv from "dotenv"
import { pingMinIO } from "./backup-handler/minio-client.js";
import { loadBackups, startBackups } from "./backup-handler/minio-uploader.js";

dotenv.config()

//connect redis
connectRedis();
pingMinIO();

loadBackups().finally(()=>{
  startBackups();
})

const ENGINE_REQUEST_QUEUE = `spot-engine-request-queue`;

const sendResponse = async (queue:string, payload:EngineResponseType) => {
	await publisher.lPush(queue, JSON.stringify(payload));
}

//process request
for(;;){

	const entity = await subscriber.brPop(ENGINE_REQUEST_QUEUE, 5);
	
	if(!entity) continue;

	const parsedRequest = JSON.parse(entity.element) as EngineRequestType;

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

