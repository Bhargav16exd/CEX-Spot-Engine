
export interface BalanceStoreType {
  [userId:string]:BalanceStoreUserEntity;
}

export interface BalanceStoreUserEntity {
	balance:{
		[currencyType:string]:currencyType;
	},
	stock:{
		[stockType: string]:stockType;
	}
}

interface currencyType {
  total:number;
  locked:number;
}

interface stockType {
	total:number;
	locked:number;
}

