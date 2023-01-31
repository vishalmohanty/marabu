import {isValidId, isValidAscii, TransactionOutput, isTransactionInput, isTransactionOutput, TransactionPointer} from "./building_blocks"
import { MarabuObject } from "./object_type"
import {ErrorMessage} from "../error"
import { exists_in_db, get_from_db } from "../../../../util/database";
import { exists_in_utxo_db, get_from_utxo_db, put_in_utxo_db } from "../../../../util/utxo_database";
import { gossip } from "../../../../util/gossip";
import { create_get_object_message } from "../getobject"
import { TransactionCoinbase, TransactionCoinbaseObject } from "./transaction_coinbase";
import { TransactionPayment, TransactionPaymentObject } from "./transaction_payment";
import { canonicalize } from "json-canonicalize";

const TIMEOUT : number = 5000 // Timeout to get the txn's from a peer
// const DIFFICULTY = "00000000abc00000000000000000000000000000000000000000000000000000"
// Use this one for testing
const DIFFICULTY = "1000000000000000000000000000000000000000000000000000000000000000"
interface Block {
    type : string,
    txids : Array<string>,
    nonce : string,
    previd : string,
    created : number,
    T : string,
    miner : string,
    note : string,
    studentids : Array<string>
};

class BlockObject extends MarabuObject {
    obj : Block

    async _verify() : Promise<Boolean> {
        let blockId = MarabuObject.get_object_id(this.obj)

        // Check proof-of-work. If not, send "INVALID_BLOCK_POW"
        if (blockId >= this.obj.T) {
            (new ErrorMessage(this.socket, "INVALID_BLOCK_POW", `Block ID ${blockId} should be less than ${this.obj.T}`)).send()
            return false
        }

        // Hardcoded genesis
        if (!await exists_in_utxo_db(this.obj.previd)) {
            (new ErrorMessage(this.socket, "UNFINDABLE_OBJECT", `Temporary for PSET 3, couldn't locate previous block.`)).send()
            return false
        }
        
        // Check transactions in DB after coinbase
        for (const txid of this.obj.txids) {
            if(!await exists_in_db(txid)) {
                // If txn not present in DB, gossip "getobject" to peers
                gossip(create_get_object_message, this.blockchain_state, txid)
            }
        }

        // Wait for TIMEOUT
        await new Promise(resolve => setTimeout(resolve, TIMEOUT));


        // If still not in DB, send "UNFINDABLE_OBJECT"
        for (const txid of this.obj.txids) {
            if(!await exists_in_db(txid)) {
                (new ErrorMessage(this.socket, "UNFINDABLE_OBJECT", `Timed out waiting to receive the txn ${txid} from peers`)).send()
                return false
            }
        }

        // If we reached here, then all the required txns are present in the DB (and thus valid).

        let utxos : Array<string> = await get_from_utxo_db(this.obj.previd)
        let utxo_set : Set<string> = new Set(utxos)
        console.log(utxo_set)
        if(this.obj.txids.length > 0) {
            // Check to make sure at most 1 coinbase and it is at txid @ 0
            let maybe_coinbase_txid = this.obj.txids[0]
            let maybe_coinbase_tx = await get_from_db(maybe_coinbase_txid)
            let coinbase_present = false
            let coinbase_amount = -1
            if(TransactionCoinbaseObject.isThisObject(maybe_coinbase_tx)) {
                coinbase_amount = maybe_coinbase_tx.outputs.map(output => output.value).reduce((a, b) => a+b)
                coinbase_present = true
            }

            // Validate txns in order. If any failure, send the error returned by that validation.
            // Update UTXO set after validating each txn.
            let total_input = 0
            let total_output = 0
            for (const txid of this.obj.txids.slice(coinbase_present ? 1 : 0)) {
                const txn : TransactionPayment = await get_from_db(txid)
                if (!TransactionPaymentObject.isThisObject(txn)) {
                    (new ErrorMessage(this.socket, "INVALID_FORMAT", `Invalid payment transaction ${txid}`)).send()
                    return false
                }
                // Ensure the coinbase transaction isn't being spent in this block
                if(coinbase_present) {
                    if(!txn.inputs.every(input => input.outpoint.txid != maybe_coinbase_tx)) {
                        (new ErrorMessage(this.socket, "INVALID_BLOCK_COINBASE", `There was an attempt to spent the coinbase transaction within this block`)).send()
                        return false
                    }
                }
                for(const input_tx of txn.inputs) {
                    // Make sure no double spending across all transactions
                    if(!utxo_set.has(canonicalize(input_tx.outpoint))) {
                        (new ErrorMessage(this.socket, "INVALID_TX_OUTPOINT", `Either a doublespend or trying to spend an invalid UTXO was detected`)).send()
                        return false
                    }
                    let tx : TransactionCoinbase | TransactionPayment = await get_from_db(input_tx.outpoint.txid)
                    total_input += tx.outputs[input_tx.outpoint.index].value
                    utxo_set.delete(canonicalize(input_tx.outpoint))
                }
                // All the outputs of this transaction become UTXOs
                for(const [index, output_tx] of txn.outputs.entries()) {
                    total_output += output_tx.value
                    let new_utxo : TransactionPointer = {
                        txid: txid,
                        index: index
                    }
                    utxo_set.add(canonicalize(new_utxo))
                }
            }

            if(coinbase_present) {
                // Add coinbase outputs to UTXO set
                let coinbase_txid = this.obj.txids[0]
                let coinbase_tx : TransactionCoinbase = await get_from_db(coinbase_txid)
                for(let idx=0; idx < coinbase_tx.outputs.length; idx++) {
                    let new_utxo : TransactionPointer = {
                        txid: coinbase_txid,
                        index: idx
                    }
                    utxo_set.add(canonicalize(new_utxo))
                }
            }
            
            // Coinbase txn value can be atmost 50 + inputs - outputs. If not, send "INVALID_BLOCK_COINBASE"
            if(coinbase_present && coinbase_amount > 50*10**12 + total_input - total_output) {
                (new ErrorMessage(this.socket, "INVALID_BLOCK_COINBASE", `Miner is skimming a little more than they should: ${coinbase_amount} > ${50 + total_input - total_output}`)).send()
                return false
            }

        }

        // Write back new UTXO set for this block
        let block_utxo = Array.from(utxo_set)
        await put_in_utxo_db(blockId, block_utxo)

        return true
    }

    static isThisObject(obj : any) : obj is Block {
        // is genesis OR valid block
        return obj && ((MarabuObject.get_object_id(obj) == "0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2") || (
            Array.isArray(obj.txids) &&
            obj.txids.every((txid) => isValidId(txid)) &&
            isValidId(obj.nonce) && 
            isValidId(obj.previd) && 
            obj.T === DIFFICULTY &&
            isValidAscii(obj.miner) &&
            isValidAscii(obj.note)
            &&
            ((obj.studentids == undefined) ||
            (Array.isArray(obj.studentids) && obj.studentids.every((id) => isValidAscii(id))))
        ))
    }
}

export {BlockObject, Block}

// {"type": "object", "object": {"T":"00000000abc00000000000000000000000000000000000000000000000000000","created":1671148800,"miner":"Marabu Bounty Hunter","nonce":"15551b5116783ace79cf19d95cca707a94f48e4cc69f3db32f41081dab3e6641","note":"First block on genesis, 50 bu reward","previd":"0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2","txids":["8265faf623dfbcb17528fcd2e67fdf78de791ed4c7c60480e8cd21c6cdc8bcd4"],"type":"block"}}