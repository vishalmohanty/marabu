import {isValidId, isValidAscii, TransactionOutput, isTransactionInput, isTransactionOutput} from "./building_blocks"
import { MarabuObject } from "./types"
import {canonicalize} from "json-canonicalize";
import {ErrorMessage} from "../error"
import { exists_in_db, get_from_db } from "../../../../util/database";
import { gossip } from "../../../../util/gossip";
import { create_get_object_message } from "../getobject"
import { TransactionCoinbaseObject } from "./transaction_coinbase";
import { TransactionPaymentObject } from "./transaction_payment";

const TIMEOUT : number = 10000 // Timeout to get the txn from a peer

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
        let block_deepcopy : Block = JSON.parse(JSON.stringify(this.obj))
        let blockId = this.get_object_id()

        // Check proof-of-work. If not, send "INVALID_BLOCK_POW"
        if (blockId >= this.obj.T) {
            (new ErrorMessage(this.socket, "INVALID_BLOCK_POW", `Block ID ${blockId} should be less than ${this.obj.T}`)).send()
        }

        // Check transactions in DB
        for (const txid of this.obj.txids) {
            if(!await exists_in_db(txid)) {
                // If txn not present in DB, gossip "getobject" to peers
                gossip(create_get_object_message, this.blockchain_state, txid)

                // Start a timer to get the peer. On timing out, check if txn is present in DB.
                // If not, send "UNFINDABLE_OBJECT"
                let timeoutID = setTimeout(async () => {
                    if(!await exists_in_db(txid)) {
                        (new ErrorMessage(this.socket, "UNFINDABLE_OBJECT", `Timed out waiting to receive the txn ${txid} from peers`)).send()
                    }
                }, TIMEOUT);
            }
        }

        // If we reached here, then all the required txns are present in the DB.

        // Check only one coinbase txn in block and at index 0. If not, send "INVALID_BLOCK_COINBASE"
        const coinbaseTxdId = this.obj.txids[0]
        const coinbaseTxn = await get_from_db(coinbaseTxdId)
        if (!TransactionCoinbaseObject.isThisObject(coinbaseTxn)) {
            (new ErrorMessage(this.socket, "INVALID_BLOCK_COINBASE", `Invalid coinbase txn ${coinbaseTxdId} at beginning of block.`)).send()
        }

        // Store the coinbase outputs so that they can't be
        // used in the same block
        const coinbaseOuts = coinbaseTxn.outputs.map(out => {out.pubkey})

        // Validate txns in order. If any failure, send the error returned by that validation.
        // Update UTXO set after validating each txn.
        for (const txid of this.obj.txids.slice(1)) {
            const txn = await get_from_db(txid)
            if (!TransactionPaymentObject.isThisObject(txn)) {
                (new ErrorMessage(this.socket, "INVALID_FORMAT", `Invalid payment transaction ${txid}`)).send()
            }
        }

        // If coinbase txn is spent by another transaction in block, send "INVALID_TX_OUTPOINT"


        // Coinbase txn value can be atmost 50 + inputs - outputs. If not, send "INVALID_BLOCK_COINBASE"

        return true
    }

    static isThisObject(obj : any) : obj is Block {
        return obj && 
        obj.txids.every((txid) => isValidId(txid)) &&
        isValidId(obj.nonce) && 
        isValidId(obj.previd) && 
        obj.T == "00000000abc00000000000000000000000000000000000000000000000000000" &&
        isValidAscii(obj.miner) &&
        isValidAscii(obj.note) &&
        obj.studentids.every((id) => isValidAscii(id))
    }
}

export {BlockObject, Block}