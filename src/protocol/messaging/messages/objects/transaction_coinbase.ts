import { ErrorMessage } from "../error"
import {TransactionOutput, isTransactionInput, isTransactionOutput} from "./building_blocks"
import { MarabuObject } from "./object_type"

interface TransactionCoinbase {
    type : string,
    height : number,
    outputs : Array<TransactionOutput>
};

class TransactionCoinbaseObject extends MarabuObject {
    obj : TransactionCoinbase
    async _verify() : Promise<Boolean> {
        // If inputs and outputs are empty, return INVALID_FORMAT
        if (this.obj.outputs.length == 0) {
            (new ErrorMessage(this.socket, "INVALID_FORMAT", `Inputs and outputs of transaction ${MarabuObject.get_object_id(this.obj)} are missing`)).send()
            return false
        }
        return true
    }

    static isThisObject(obj : any) : obj is TransactionCoinbase {
        return obj && (typeof obj.type == "string") && (obj.type == "transaction") && (typeof obj.height == "number") && (obj.height >= 0) && obj.outputs.every((output) => isTransactionOutput(output))
    }
}

export {TransactionCoinbaseObject, TransactionCoinbase}