export interface Transaction {
  date: string;
  valueDate: string;
  particulars: string;
  tranType: string;
  tranId: string;
  chequeDetails: string;
  withdrawals: number | "";
  deposits: number | "";
  balance: number;
  balanceType: string;
}

export interface ParseResult {
  transactions: Transaction[];
  bankName: string;
}
