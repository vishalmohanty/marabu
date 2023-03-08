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

        // If inputs and outputs are empty, return INVALID_FORMAT
        if (this.obj.inputs.length == 0 && this.obj.outputs.length == 0) {
            (new ErrorMessage(this.socket, "INVALID_FORMAT", `Inputs and outputs of transaction ${MarabuObject.get_object_id(this.obj)} are missing`)).send()
            return false
        }

        let valid_in_mempool = true
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

            // Check if transaction is valid wrt mempool state
            if (!this.blockchain_state.mempool_state.has(canonicalize(input.outpoint))) {
                console.log("Mempool state ", this.blockchain_state.mempool_state);
                (new ErrorMessage(this.socket, "INVALID_TX_OUTPOINT", `Not valid according to our mempool`)).send()
                console.log("[transaction_payment] Transaction ", MarabuObject.get_object_id(this.obj), " is not valid in mempool")
                valid_in_mempool = false
            }
        }
        // Verify conservation
        let output_sum : number = this.obj.outputs.length ? this.obj.outputs.map((output) => output.value).reduce((prev, curr) => prev+curr) : 0
        if(input_sum < output_sum) {
            (new ErrorMessage(this.socket, "INVALID_TX_CONSERVATION", `Input sum is ${input_sum}, output sum is ${output_sum}`)).send()
            return false
        }

        if(valid_in_mempool) {
            const txid: string = MarabuObject.get_object_id(this.obj)
            // Add txn to mempool after it is validated
            this.blockchain_state.add_to_mempool(txid)

            // Add the outpoints of this transaction to the mempool state
            const new_utxos: Set<string> = getTransactionOutpoints(this.obj, txid)
            new_utxos.forEach(utxo => this.blockchain_state.mempool_state.add(utxo))

            // Remove the used outpoints
            const remove_utxos: Set<string> = getTransactionInpoints(this.obj, txid)
            remove_utxos.forEach(utxo => this.blockchain_state.mempool_state.delete(utxo))
            console.log("[transaction_payment] Added transaction ", txid, " to mempool.\nCurrent mempool: ", this.blockchain_state.mempool, "\nCurrent mempool_state: ", this.blockchain_state.mempool_state)
        }
        
        // Hack, we need to add to DB manually so add_object in run_receive returns false and we don't gossip
        if(!valid_in_mempool) {
            await this.add_object()
        }
        
        return true
    }

    static isThisObject(obj : any) : obj is TransactionPayment {
        return obj && (typeof obj.type == "string") && (obj.type == "transaction") && Array.isArray(obj.inputs) && obj.inputs.every((inp) => isTransactionInput(inp)) && Array.isArray(obj.outputs) && obj.outputs.every((output) => isTransactionOutput(output))
    }

    // Returns true if you should gossip ihaveobject
    async run_receive() : Promise<Boolean> {
        if(await exists_in_db(MarabuObject.get_object_id(this.obj))) {
            // Try to add to the mempool, if successful, gossip
            for(const input of this.obj.inputs) {
                if (!this.blockchain_state.mempool_state.has(canonicalize(input.outpoint))) {
                    console.log("Mempool state 2: ", this.blockchain_state.mempool_state);
                    (new ErrorMessage(this.socket, "INVALID_TX_OUTPOINT", `Not valid according to our mempool`)).send()
                    return false
                }
            }

            const txid: string = MarabuObject.get_object_id(this.obj)
            // Add txn to mempool after it is validated
            this.blockchain_state.add_to_mempool(txid)

            // Add the outpoints of this transaction to the mempool state
            const new_utxos: Set<string> = getTransactionOutpoints(this.obj, txid)
            new_utxos.forEach(utxo => this.blockchain_state.mempool_state.add(utxo))

            // Remove the used outpoints
            const remove_utxos: Set<string> = getTransactionInpoints(this.obj, txid)
            remove_utxos.forEach(utxo => this.blockchain_state.mempool_state.delete(utxo))

            // Gossip, since we added transaction to mempool
            return true
        }
        if(!await this._verify()) {
            return false
        }
        if(!await this.add_object()) {
            return false
        }
        return true
    }
}

export {TransactionPaymentObject, TransactionPayment}