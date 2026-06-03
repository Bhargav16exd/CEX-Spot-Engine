import type { BalanceStoreType } from "./balance-type.js";

const BALANCE_STORE : BalanceStoreType = {};


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

/* 
  ------ QUEUE REQUEST HANDLERS ------
  ------------------------------------
*/ 

export const handle_INIT_USER_BALANCE_Request = (payload:any) => {
  
  const { id } = payload;
  if( !id ) throw new Error("Invalid Input");

  BALANCE_STORE[id] = {
    balance:{
      "inr":{
        total:0,
        locked:0
      }
    },
    stock:{}
  }

  return true
}

export const handle_UPDATE_USER_BALANCE_Request = (payload:any) =>{
  const { id, balance } = payload
  if(!id || !balance){
    throw new Error("Invalid Inputs");
  }
  
  const userBalance = readBalanceStoreUserTotalBalance(id)

  if( userBalance === undefined ){
    throw new Error("Invalid User Id");
  }

  updateBalanceStoreUserTotalBalance(id, userBalance + balance);

  return {
    balance:readBalanceStoreUserTotalBalance(id)
  }
}

export const handle_GET_USER_BALANCE_Request = (payload:any) => {
  const { id } = payload;

  if(!id){
    throw new Error("Invalid Inputs");
  }

  const totalBalance = readBalanceStoreUserTotalBalance(id)
  const lockedBalance = readBalanceStoreUserLockedBalance(id);

  if(totalBalance === undefined || lockedBalance === undefined){
    throw new Error("Invalid User Id")
  }

  return {
    balance: (totalBalance - lockedBalance)
  }
}

/* 
  ------ LOADING BACKUPS IN MEMORY ------
  ---------------------------------------
*/

export const loadBalances = (backup : BalanceStoreType) => {
  Object.assign(BALANCE_STORE, backup);
}

export default BALANCE_STORE;