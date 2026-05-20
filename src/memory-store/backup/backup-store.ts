import fs from "fs"
import BALANCE_STORE, { putBackupInBalanceStore } from "../balance/balance-store.js";
import { fileURLToPath } from "url";
import path from "path";
import { ORDERBOOK_STORE, ORDERBOOK_STORE_INDEX } from "../orderbook/orderbook-store.js";

enum storeType {
    BALANCE = "BALANCE",
    ORDER_BOOK = "ORDER_BOOK",
    ORDER_BOOK__INDEX = "ORDER_BOOK_INDEX"
}

// ------ BACKUP REGION START ------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const balanceStoreBackupFilePath = path.join(
    __dirname,
    "../../memory-store-backup/balances.backup.txt"
);

const orderBookStoreBackupFilePath = path.join(
    __dirname,
    "../../memory-store-backup/orderbook.backup.txt"
);

const orderBookIndexStoreBackupFilePath = path.join(
    __dirname,
    "../../memory-store-backup/orderbook-index.backup.txt"
);


const backupStoreEntityHelper = async (entity:any, storeTypeName:storeType) => {
    let filePath = null;

    if(storeTypeName == storeType.BALANCE){
        filePath = balanceStoreBackupFilePath
    }

    if(storeTypeName == storeType.ORDER_BOOK){
        filePath = orderBookStoreBackupFilePath
    }

    if(storeTypeName == storeType.ORDER_BOOK__INDEX){
        filePath = orderBookIndexStoreBackupFilePath
    }

    if(!filePath){
        return
    }

    const stringifyEntity = JSON.stringify(entity);
    fs.writeFileSync(filePath,stringifyEntity,'utf-8')

}

export const initBalancesBackup = () => {
    setInterval(() => {
        backupStoreEntityHelper(BALANCE_STORE,storeType.BALANCE)
    }, 5000)
}

export const initOrderBookBackup = () => {
    setInterval(() => {
        backupStoreEntityHelper(ORDERBOOK_STORE,storeType.ORDER_BOOK);
        backupStoreEntityHelper(ORDERBOOK_STORE_INDEX, storeType.ORDER_BOOK__INDEX);
    },5000)
}

// ------ BACKUP REGION END ------

// ------ LOAD BACKUP REGION START ------
const initLoadBackup = async (storeTypeName:storeType) => {

    let filePath = null;

    if(storeTypeName == storeType.BALANCE){
        filePath = balanceStoreBackupFilePath
    }

    if(storeTypeName == storeType.ORDER_BOOK){
        filePath = orderBookStoreBackupFilePath
    }

    if(!filePath){
        return
    }

    const stringifiedData = fs.readFileSync(filePath,'utf-8');
    const shallowBackupCopy = JSON.parse(stringifiedData);

    if(storeTypeName == storeType.BALANCE){
        putBackupInBalanceStore(shallowBackupCopy)
        return
    }

    if(storeTypeName == storeType.ORDER_BOOK){
        //TBD
        //filePath = orderBookStoreBackupFilePath
        return
    }

    console.log("Invalid Store Type",storeTypeName)
    return 
}

export const loadBalanceBackup = async () => {
    await initLoadBackup(storeType.BALANCE);
    console.log("LOADED BACKUP FOR BALANCE");
}

export const loadOrderBookBackup = async () => {
    await initLoadBackup(storeType.ORDER_BOOK);
    console.log("LOADED BACKUP FOR ORDER BOOK")
}
// ------ LOAD BACKUP REGION END ------