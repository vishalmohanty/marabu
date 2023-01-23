import { MarabuObject } from "./types";
import { TransactionPaymentObject } from "./transaction_payment"
import { TransactionCoinbaseObject } from "./transaction_coinbase";

let options : Array<typeof MarabuObject> = [TransactionPaymentObject, TransactionCoinbaseObject]

function object_selector(obj : any) : any {
    for(const option of options) {
        if(option.isThisObject(obj)) {
            return option
        }
    }
    return undefined
}

export {object_selector}