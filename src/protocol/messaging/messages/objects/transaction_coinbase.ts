import {TransactionOutput, isTransactionInput, isTransactionOutput} from "./building_blocks"
import { MarabuObject } from "./types"

interface TransactionCoinbase {
    type : string,
    height : number,
    outputs : Array<TransactionOutput>
};

class TransactionCoinbaseObject extends MarabuObject {
    obj : TransactionCoinbase
    async _verify() : Promise<Boolean> {
        return true
    }

    static isThisObject(obj : any) : obj is TransactionCoinbase {
        return obj && (typeof obj.type == "string") && (obj.type == "transaction") && (typeof obj.height == "number") && (obj.height >= 0) && obj.outputs.every((output) => isTransactionOutput(output))
    }
}

export {TransactionCoinbaseObject, TransactionCoinbase}