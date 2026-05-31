import type { BalanceStoreType } from "./balance-type.js";

const BALANCE_STORE:BalanceStoreType = {};

interface User {
  username: string;
  password: string;
  balance: number;
  id: number;
}

export const initUserInBalanceStore = (user:User) => {  
  BALANCE_STORE[user.id] = {
    balance:{
      "inr":{
        total:user.balance,
        locked:0,
      },
        
    },
    stock:{
      "sol":{
        total:20,
        locked:0
      }
    }
  }
}

//@ts-ignore
export const putBackupInBalanceStore = (data) => {
  // clear existing keys
  Object.keys(BALANCE_STORE).forEach(key => {
      delete BALANCE_STORE[key]
  })

  Object.assign(BALANCE_STORE, data);
}
export const readBalanceStoreUserTotalBalance = (userId:string) => {
    //@ts-ignore
    return BALANCE_STORE[userId].balance["inr"].total
}
export const readBalanceStoreUserLockedBalance = (userId:string) => {
    //@ts-ignore
    return BALANCE_STORE[userId].balance["inr"].locked
}

export const updateBalanceStoreUserTotalBalance = (userId:string, value:number) => {
    //@ts-ignore
    BALANCE_STORE[userId].balance["inr"].total = value
}

export const updateBalanceStoreUserLockedBalance = (userId:string, value:number) => {
    //@ts-ignore
    BALANCE_STORE[userId].balance["inr"].locked = value
}

// ----- STOCK READ ----
export const readBalanceStoreUserTotalStocks = (userId:string, stockSymbol:string) => {
    return BALANCE_STORE[userId]?.stock[stockSymbol]?.total!
}
export const readBalanceStoreUserLockedStocks = (userId:string, stockSymbol:string) => {
    return BALANCE_STORE[userId]?.stock[stockSymbol]?.locked!
}
// ----- STOCK READ ----

// ----- STOCK UPDATE ----
export const updateBalanceStoreUserTotalStocks = (userId:string, stockSymbol:string, value:number) => {
    //@ts-ignore
    BALANCE_STORE[userId].stock[stockSymbol].total = value
}

export const updateBalanceStoreUserLockedStocks = (userId:string, stockSymbol:string, value:number) => {
    //@ts-ignore
    BALANCE_STORE[userId].stock[stockSymbol].locked = value;
}

export const updateBalancesAndStockForAskOrder = (stockSymbol:string, takerId:string, makerId:string, quantity:number , price:number) => {

    /*
        TAKER : the one who is calling the API
        MAKER : the one whos entity is already present in order book
    */

    //taker : reduce stocks , refresh locked stocks , increment the user balances

    //read taker
    const takerPreviousTotalStocks = readBalanceStoreUserTotalStocks(takerId, stockSymbol);
    const takerPreviousLockedStocks = readBalanceStoreUserLockedStocks(takerId, stockSymbol);
    const takerPreviousTotalBalance = readBalanceStoreUserTotalBalance(takerId); 
    
    //update taker
    updateBalanceStoreUserTotalStocks(takerId, stockSymbol, (takerPreviousTotalStocks - quantity));
    updateBalanceStoreUserLockedStocks(takerId, stockSymbol, (takerPreviousLockedStocks - quantity));
    updateBalanceStoreUserTotalBalance(takerId, (takerPreviousTotalBalance + (quantity * price)));

    //maker : increment stocks , refresh locked balance , reduce user balances

    //read maker
    const makerPreviousTotalStocks = readBalanceStoreUserTotalStocks(makerId, stockSymbol);
    const makerPreviousTotalBalance = readBalanceStoreUserTotalBalance(makerId);
    const makerPreviousLockedBalance = readBalanceStoreUserLockedBalance(makerId);

    //update maker
    updateBalanceStoreUserTotalStocks(makerId, stockSymbol, (makerPreviousTotalStocks + quantity));
    updateBalanceStoreUserTotalBalance(makerId, (makerPreviousTotalBalance - (quantity * price)));
    updateBalanceStoreUserLockedBalance(makerId, (makerPreviousLockedBalance - (quantity * price)));

}

export const updateBalancesAndStockForBidOrder = (stockSymbol:string, takerId:string, makerId:string, quantity:number , price:number) => {

    /*
        TAKER : the one who is calling the API
        MAKER : the one whos entity is already present in order book
    */

    // taker : increment stocks , refresh locked balance , reduce user balances

    //read taker
    const takerPreviousTotalStocks = readBalanceStoreUserTotalStocks(takerId, stockSymbol);
    const takerPreviousTotalBalance = readBalanceStoreUserTotalBalance(takerId);
    const takerPreviousLockedBalance = readBalanceStoreUserLockedBalance(takerId);

    //update taker
    updateBalanceStoreUserTotalStocks(takerId, stockSymbol, (takerPreviousTotalStocks + quantity));
    updateBalanceStoreUserTotalBalance(takerId, (takerPreviousTotalBalance - (quantity * price)));
    updateBalanceStoreUserLockedBalance(takerId, (takerPreviousLockedBalance - (quantity * price)));

    // maker : reduce stocks , refresh locked stocks , increment the user balances
    
    //read maker
    const makerPreviousTotalStocks = readBalanceStoreUserTotalStocks(makerId, stockSymbol);
    const makerPreviousLockedStocks = readBalanceStoreUserLockedStocks(makerId, stockSymbol);
    const makerPreviousTotalBalance = readBalanceStoreUserTotalBalance(makerId);
    
    //update maker
    updateBalanceStoreUserTotalStocks(makerId, stockSymbol, (makerPreviousTotalStocks - quantity));
    updateBalanceStoreUserLockedStocks(makerId, stockSymbol, (makerPreviousLockedStocks - quantity));
    updateBalanceStoreUserTotalBalance(makerId, (makerPreviousTotalBalance + (quantity * price)));

}


export const hanldeUserBalanceUpdate = (payload : any):any => {
  const { id , balance, marketType } = payload
  const userTotalBalance = readBalanceStoreUserTotalBalance(id)!;
  updateBalanceStoreUserTotalBalance(id, userTotalBalance + balance)
  //@ts-ignore
  console.log(BALANCE_STORE)
  return BALANCE_STORE[id]?.balance["inr"]
}

export default BALANCE_STORE;