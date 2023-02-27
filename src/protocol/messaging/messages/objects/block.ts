import {isValidId, isValidAscii, TransactionOutput, isTransactionInput, isTransactionOutput, TransactionPointer, getTransactionOutpoints} from "./building_blocks"
import { MarabuObject } from "./object_type"
import {ErrorMessage} from "../error"
import { exists_in_db, get_from_db, put_in_db } from "../../../../util/object_database";
import { get_from_utxo_db, put_in_utxo_db } from "../../../../util/utxo_database";
import { get_from_height_db, put_in_height_db } from "../../../../util/height_database";
import { wait } from "../../../../util/util_methods";
import { gossip } from "../../../../util/gossip";
import { create_get_object_message } from "../getobject"
import { TransactionCoinbase, TransactionCoinbaseObject } from "./transaction_coinbase";
import { TransactionPayment, TransactionPaymentObject } from "./transaction_payment";
import { canonicalize } from "json-canonicalize";
import { config } from "../../../../config";
import { BlockchainState } from "../../../state/blockchain_state";

const GENESIS_ID = "0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2"
const TRANSACTION_TIMEOUT : number = 350 // Timeout to get the txn's from a peer
const PROD_DIFFICULTY = "00000000abc00000000000000000000000000000000000000000000000000000"
// Can retrieve a maximum of approximately ANCESTOR_RETRIEVAL_TIMEOUT / TRANSACTION_TIMEOUT blocks, with some hiccups
const ANCESTOR_RETRIEVAL_TIMEOUT : number = 4500
// Use this one for testing
const DEBUG_DIFFICULTY = "1000000000000000000000000000000000000000000000000000000000000000"

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

    async complete_prereqs() : Promise<Boolean> {
        if(MarabuObject.get_object_id(this.obj) == GENESIS_ID) {
            return true
        }
        let blockId = MarabuObject.get_object_id(this.obj)
        // Check proof-of-work. If not, send "INVALID_BLOCK_POW"
        if (blockId >= this.obj.T) {
            (new ErrorMessage(this.socket, "INVALID_BLOCK_POW", `Block ID ${blockId} should be less than ${this.obj.T}`)).send()
            return false
        }
        if(this.obj.previd == null) {
            (new ErrorMessage(this.socket, "INVALID_GENESIS", "Block saying its previd is null is not genesis")).send()
            return false
        }
        if(!await exists_in_db(this.obj.previd)) {
            // Try grabbing parent block
            gossip(create_get_object_message, this.blockchain_state, this.obj.previd)
            // A little hacky
            // Wait for ANCESTOR_RETRIEVAL_TIMEOUT milliseconds
            for(let i=0; i < 10; i++) {
                await wait(ANCESTOR_RETRIEVAL_TIMEOUT/10)
                if(await exists_in_db(this.obj.previd)) {
                    // Found
                    return true
                }
            }
            // If we didn't get it yet, we should send error and stop processing this object/
            (new ErrorMessage(this.socket, "UNFINDABLE_OBJECT", "Couldn't find parent chain")).send()
            return false
        }
        // Already in db, so we have parent block and it is successfully verified
        return true
    }

    async _verify() : Promise<Boolean> {
        let blockId = MarabuObject.get_object_id(this.obj)
        if(blockId == GENESIS_ID) {
            put_in_height_db(blockId, 0)
            put_in_utxo_db(blockId, [])
            return true
        }

        // Previous block already exists (we have verified that)
        let prev_block : Block = await get_from_db(this.obj.previd)

        // Verify timing
        const curr_timestamp = Date.now()/1000
        if(!((prev_block.created < this.obj.created) && (this.obj.created <= curr_timestamp))) {
            (new ErrorMessage(this.socket, "INVALID_BLOCK_TIMESTAMP", "Ensure that the timestamps for the block creation are correct.")).send()
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
        await wait(TRANSACTION_TIMEOUT)

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

        // Store the input oupoints for every transaction in the block.
        // We'll use this to update our mempool_state
        let input_txn_outpoints: Set<TransactionPointer> = new Set()

        let coinbase_present = false

        if(this.obj.txids.length > 0) {
            // Check to make sure at most 1 coinbase and it is at txid @ 0
            let maybe_coinbase_txid = this.obj.txids[0]
            let maybe_coinbase_tx = await get_from_db(maybe_coinbase_txid)
            let coinbase_amount = 0
            if(TransactionCoinbaseObject.isThisObject(maybe_coinbase_tx)) {
                if(maybe_coinbase_tx.outputs.length == 0) {
                    coinbase_amount = 0
                } else {
                    coinbase_amount = maybe_coinbase_tx.outputs.map(output => output.value).reduce((a, b) => a+b)
                }
                coinbase_present = true
            }

            // Validate txns in order. If any failure, send the error returned by that validation.
            // Update UTXO set after validating each txn.
            let total_input = 0
            let total_output = 0
            for (const txid of this.obj.txids.slice(coinbase_present ? 1 : 0)) {
                const txn : TransactionPayment = await get_from_db(txid)
                if (TransactionCoinbaseObject.isThisObject(txn)) {
                    (new ErrorMessage(this.socket, "INVALID_BLOCK_COINBASE", `Invalid coinbase transaction ${txid}. There can only be 1 coinbase transaction and it has to be the first transaction of the block.`)).send()
                    return false
                }
                if (!TransactionPaymentObject.isThisObject(txn)) {
                    (new ErrorMessage(this.socket, "INVALID_FORMAT", `ID: ${txid} is not a transaction.`)).send()
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
                    input_txn_outpoints.add(input_tx.outpoint)
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
                let coinbase_txid = this.obj.txids[0]
                let coinbase_tx : TransactionCoinbase = await get_from_db(coinbase_txid)
                // Check to make sure the height in the coinbase matches the height of the block
                const prev_height = await get_from_height_db(this.obj.previd)
                if(coinbase_tx.height != prev_height + 1) {
                    (new ErrorMessage(this.socket, "INVALID_BLOCK_COINBASE", `The coinbase height is set to ${coinbase_tx.height} when we expected ${prev_height+1}`)).send()
                    return false
                }
                // Add coinbase outputs to UTXO set
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
        
        // Write back height for this block
        let new_height = (await get_from_height_db(this.obj.previd))+1
        await put_in_height_db(blockId, new_height)

        // Check if this is max height and update chaintip if it is
        if(new_height > this.blockchain_state.chain_length) {
            
            // When chaintip is updated, set the mempool_state to the UTXO set
            this.blockchain_state.mempool_state = structuredClone(utxo_set)

            // If reorg happens, need to apply all transactions in the older fork
            if (this.obj.previd != this.blockchain_state.chaintip) {
                // Get the blocks in the new chain ending at this block
                let blocksInChain: Set<string> = await this.getBlocksInChain(blockId)

                // Find the first block in the old fork that has previous
                // block in the blocksInChain
                let fork: Array<Block> = await this.getForkFromChain(this.blockchain_state.chaintip, blocksInChain)

                // Apply the transactions in the blocks in the fork
                for (const block_id in fork) {
                    let fork_block: Block = await get_from_db(block_id)
                    for (const txid of fork_block.txids) {
                        let txn = await get_from_db(txid)
                        if (TransactionPaymentObject.isThisObject(txn)) {
                            await this.addTxnToMempool(txid, this.blockchain_state)
                        }
                    }
                }
            } else {
                // Else when the chain grows on top of the current chaintip,
                // we apply the transactions from the current mempool
                // and update the mempool state after each transaction
                for (const txid of this.obj.txids.slice(coinbase_present ? 1 : 0)) {
                    await this.addTxnToMempool(txid, this.blockchain_state)
                }
            }

            this.blockchain_state.chain_length = new_height
            this.blockchain_state.chaintip = blockId
            console.log(`Setting a new chaintip to ${blockId}, new height is ${new_height}`)
        }

        return true
    }

    static isThisObject(obj : any) : obj is Block {
        return obj && (
            Array.isArray(obj.txids) &&
            obj.txids.every((txid) => isValidId(txid)) &&
            // isValidId(obj.nonce) && 
            (isValidId(obj.previd) || obj.previd == null) &&
            obj.T === (config.debug ? DEBUG_DIFFICULTY : PROD_DIFFICULTY)  &&
            (!obj.hasOwnProperty("miner") || isValidAscii(obj.miner)) &&
            (!obj.hasOwnProperty("note") || isValidAscii(obj.note)) &&
            ((obj.studentids == undefined) ||
            (Array.isArray(obj.studentids) && obj.studentids.every((id) => isValidAscii(id))))
        )
    }

    async getBlocksInChain(blockId: string): Promise<Set<string>> {
        if (blockId == GENESIS_ID) {
            let chain: Set<string> = new Set()
            chain.add(blockId)
            return chain
        }
        let block: Block = await get_from_db(blockId)
        let chain: Set<string> = await this.getBlocksInChain(block.previd)
        chain.add(blockId)
        return chain
    }

    async getForkFromChain(blockId: string, chainSet: Set<string>): Promise<Array<Block>> {
        if (chainSet.has(blockId) || blockId == null) {
            return new Array()
        }
        let block: Block = await get_from_db(blockId)
        let arr: Array<Block> = await this.getForkFromChain(block.previd, chainSet)
        arr.push(block)
        return arr
    }

    async addTxnToMempool(txid: string, blockchain_state: BlockchainState) {
        let txn: TransactionPayment = await get_from_db(txid)
        let isValid: boolean = true
        for (const inp of txn.inputs) {
            if (!blockchain_state.mempool_state.has(canonicalize(inp.outpoint))) {
                isValid = false
                break
            }
        }
        if (isValid) {
            blockchain_state.mempool.push(txid)
            const new_utxos: Set<string> = getTransactionOutpoints(txn, txid)
            new_utxos.forEach(utxo => blockchain_state.mempool_state.add(utxo))
        }
    }
}

export {BlockObject, Block}

// {"type": "object", "object": {"T":"00000000abc00000000000000000000000000000000000000000000000000000","created":1671148800,"miner":"Marabu Bounty Hunter","nonce":"15551b5116783ace79cf19d95cca707a94f48e4cc69f3db32f41081dab3e6641","note":"First block on genesis, 50 bu reward","previd":"0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2","txids":["8265faf623dfbcb17528fcd2e67fdf78de791ed4c7c60480e8cd21c6cdc8bcd4"],"type":"block"}}
