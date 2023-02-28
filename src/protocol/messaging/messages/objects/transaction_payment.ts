import {TransactionInput, TransactionOutput, isTransactionInput, isTransactionOutput, TransactionPointer, getTransactionOutpoints, getTransactionInpoints} from "./building_blocks"
import { MarabuObject } from "./object_type"
import {exists_in_db, get_from_db} from "../../../../util/object_database"
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
        let cur_outpoints: Set<string> = this.blockchain_state.mempool_state

        for(const input of this.obj.inputs) {
            let txid : string = input.outpoint.txid
            // Check to see if input transaction point back to a valid transaction
            if(!await exists_in_db(txid)) {
                // Send a find request, if you get no response, respond with UNFINDABLE_OBJECT
                // If someone sends you an object but you find an error, respond with that error message here
                (new ErrorMessage(this.socket, "UNKNOWN_OBJECT", `The transaction id ${txid} could not be found`)).send()
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

            // Check if transaction double spends with mempool
            if (!TransactionPaymentObject.outpointInMempool(input.outpoint, cur_outpoints)) {
                (new ErrorMessage(this.socket, "INVALID_TX_OUTPOINT", `Not valid according to our mempool`)).send()
                // return false
            }
        }
        // Verify conservation
        let output_sum : number = this.obj.outputs.map((output) => output.value).reduce((prev, curr) => prev+curr)
        if(input_sum < output_sum) {
            (new ErrorMessage(this.socket, "INVALID_TX_CONSERVATION", `Input sum is ${input_sum}, output sum is ${output_sum}`)).send()
            return false
        }

        const txid: string = MarabuObject.get_object_id(this.obj)
        // Add txn to mempool after it is validated
        this.blockchain_state.mempool.push(txid)

        // Add the outpoints of this transaction to the mempool state
        const new_utxos: Set<string> = getTransactionOutpoints(this.obj, txid)
        new_utxos.forEach(utxo => this.blockchain_state.mempool_state.add(utxo))

        // Remove the used outpoints
        const remove_utxos: Set<string> = getTransactionInpoints(this.obj, txid)
        remove_utxos.forEach(utxo => this.blockchain_state.mempool_state.delete(utxo))
        
        return true
    }

    static isThisObject(obj : any) : obj is TransactionPayment {
        return obj && (typeof obj.type == "string") && (obj.type == "transaction") && Array.isArray(obj.inputs) && obj.inputs.every((inp) => isTransactionInput(inp)) && Array.isArray(obj.outputs) && obj.outputs.every((output) => isTransactionOutput(output))
    }

    static outpointInMempool(outpoint: TransactionPointer, mempoolState: Set<string>): Boolean {
        return mempoolState.has(canonicalize(outpoint))
    }
}

export {TransactionPaymentObject, TransactionPayment}