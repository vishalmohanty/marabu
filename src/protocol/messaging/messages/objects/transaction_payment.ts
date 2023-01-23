import {TransactionInput, TransactionOutput, isTransactionInput, isTransactionOutput} from "./building_blocks"
import { MarabuObject } from "./types"
import {exists_in_db, get_from_db} from "../../../../util/database"
import {ErrorMessage} from "../error"
import {TransactionCoinbase} from "./transaction_coinbase"
import * as ed25519 from "@noble/ed25519"
import { canonicalize } from "json-canonicalize"

interface TransactionPayment {
    type : string,
    inputs : Array<TransactionInput>,
    outputs : Array<TransactionOutput>
};

class TransactionPaymentObject extends MarabuObject {
    obj : TransactionPayment
    async _verify() : Promise<Boolean> {
        let transaction_deepcopy : TransactionPayment = JSON.parse(JSON.stringify(this.obj))
        for(const input of transaction_deepcopy.inputs) {
            input.sig = null
        }
        let to_sign_message : string = canonicalize(transaction_deepcopy)
        let input_sum : number = 0
        for(const input of this.obj.inputs) {
            let txid : string = input.outpoint.txid
            // Check to see if input transaction point back to a valid transaction
            if(!await exists_in_db(txid)) {
                (new ErrorMessage(this.socket, "UNFINDABLE_OBJECT", `The transaction id ${txid} could not be found`)).send()
                return false
            }
            let output_transaction : TransactionPayment | TransactionCoinbase = await get_from_db(txid)
            if(input.outpoint.index >= output_transaction.outputs.length) {
                (new ErrorMessage(this.socket, "INVALID_TX_OUTPOINT", `${input.outpoint.index} >= ${output_transaction.outputs.length}`)).send()
                return false
            }
            // Check signature validity
            let signature = input.sig
            let pk = output_transaction.outputs[input.outpoint.index].pubkey
            if(!await ed25519.verify(signature, Uint8Array.from(Buffer.from(to_sign_message)), pk)) {
                (new ErrorMessage(this.socket, "INVALID_TX_SIGNATURE", `Failed to validate with public key from ${txid}, index ${input.outpoint.index}: ${pk}`)).send()
                return false 
            }
            input_sum += output_transaction.outputs[input.outpoint.index].value
        }
        // Verify conservation
        let output_sum : number = this.obj.outputs.map((output) => output.value).reduce((prev, curr) => prev+curr)
        if(input_sum < output_sum) {
            (new ErrorMessage(this.socket, "INVALID_TX_CONSERVATION", `Input sum is ${input_sum}, output sum is ${output_sum}`)).send()
            return false
        }
        return true
    }

    static isThisObject(obj : any) : obj is TransactionPayment {
        return obj && (typeof obj.type == "string") && Array.isArray(obj.inputs) && obj.inputs.every((inp) => isTransactionInput(inp)) && Array.isArray(obj.outputs) && obj.outputs.every((output) => isTransactionOutput(output))
    }
}

export {TransactionPaymentObject, TransactionPayment}