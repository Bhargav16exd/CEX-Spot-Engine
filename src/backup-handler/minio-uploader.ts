import path from "node:path";
import fs from "fs/promises";
import minIOClient from "./minio-client.js"
import type { BackupTypes } from "./backup.types.js";
import { loadOrderbook, ORDERBOOK_STORE, ORDERBOOK_STORE_INDEX } from "../memory/orderbook/orderbook-store.js";
import BALANCE_STORE, { loadBalances } from "../memory/balance/balance-store.js";
import { ACTIVE_ORDERS_INDEX, loadOrders, ORDERS } from "../memory/orders/order.js";


const BUCKET_NAME = "centralized-exchange-bucket"
const FILE_NAME = "spot-state.json";

const UPLOAD_LOCAL_STATE_FILE = path.join(`${process.cwd()}/src/backup/upload/`, "spot-state.json");
const DOWNLOAD_LOCAL_STATE_FILE = path.join(`${process.cwd()}/src/backup/download/`, "spot-state.json");


export const backupServerState = async () =>{
  try {

    await writeStateIntoFile()

    const exists = await minIOClient.bucketExists(BUCKET_NAME);

    if (!exists) {
      await minIOClient.makeBucket(BUCKET_NAME, 'ap-south-1');
    }

    await minIOClient.fPutObject(BUCKET_NAME, FILE_NAME, UPLOAD_LOCAL_STATE_FILE);

    await fs.unlink(UPLOAD_LOCAL_STATE_FILE);

  } catch (error) {
    console.log(error)
  }
}

const writeStateIntoFile = async () => {

  try {
    const data = {
      ORDERBOOK_STORE,
      ORDERBOOK_STORE_INDEX,
      BALANCE_STORE,
      ORDERS,
      ACTIVE_ORDERS_INDEX,
      updatedAt: Date.now(),
    };
  
    await fs.writeFile(
      UPLOAD_LOCAL_STATE_FILE,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.log(error)
  }
}

export const loadBackups = async () =>{

  try {

    await minIOClient.fGetObject(BUCKET_NAME, FILE_NAME, DOWNLOAD_LOCAL_STATE_FILE);

    const jsonStringBackupData = await fs.readFile(DOWNLOAD_LOCAL_STATE_FILE, {encoding:"utf-8"});
    
    const parsedBackup  = JSON.parse(jsonStringBackupData) as BackupTypes;

    loadBalances(parsedBackup.BALANCE_STORE);
    loadOrderbook(parsedBackup.ORDERBOOK_STORE, parsedBackup.ORDERBOOK_STORE_INDEX);
    loadOrders(parsedBackup.ORDERS, parsedBackup.ACTIVE_ORDER_INDEX);
    
    await fs.unlink(DOWNLOAD_LOCAL_STATE_FILE);

  } catch (error:any) {
     if(error.message == "Not Found"){
      return
    }
    console.log(error);
  }
}

export const startBackups = () =>{
  setInterval(async ()=>{
    await backupServerState();
  }, 5000)
}