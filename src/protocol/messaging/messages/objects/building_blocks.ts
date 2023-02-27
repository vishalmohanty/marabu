import { TransactionPayment } from "./transaction_payment"
import { canonicalize } from "json-canonicalize";

let hex_chars = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"])

function is_all_hex(s : string) {
    return Array.from(s).every((val) => hex_chars.has(val))
}

function isValidAscii(s: any) : boolean {
    return (typeof s == "string") && (s.length <= 128)
}

// Transaction ID, block ID, nonce are all 32-byte hexadecimals
function isValidId(s: any) : boolean {
    return (typeof s == "string") && (s.length == 64) && is_all_hex(s)
}

interface TransactionPointer {
    txid : string,
    index : number
}

// User-defined type guard
function isTransactionPointer(obj : any) : obj is TransactionPointer {
    return obj && isValidId(obj.txid) && (typeof obj.index == "number") && (obj.index >= 0)
}

interface TransactionInput {
    outpoint : TransactionPointer,
    sig : string
}

function isTransactionInput(obj : any) : obj is TransactionInput {
    return obj && isTransactionPointer(obj.outpoint) && (typeof obj.sig == "string") && (obj.sig.length == 128) && (is_all_hex(obj.sig))
}

interface TransactionOutput {
    pubkey : string,
    value : number
}

function isTransactionOutput(obj : any) : obj is TransactionInput {
    return obj && (typeof obj.pubkey == "string") && (obj.pubkey.length == 64) && (is_all_hex(obj.pubkey)) && (typeof obj.value == "number") && (obj.value >= 0)
}

function getTransactionOutpoints(txn: TransactionPayment, txid: string): Set<string> {
    let utxos: Set<string> = new Set()
    // Add the outpoints of this transaction to the mempool state
    for (const [index, output_tx] of txn.outputs.entries()) {
        let new_utxo = {
            txid: txid,
            index: index
        };
        utxos.add(canonicalize(new_utxo))
    }
    return utxos
}

function getTransactionInpoints(txn: TransactionPayment, txid: string): Set<string> {
    let utxos: Set<string> = new Set()
    for (const input of txn.inputs) {
        let old_utxo = {
            txid: input.outpoint.txid,
            index: input.outpoint.index
        };
        utxos.add(canonicalize(old_utxo))
    }
    return utxos
}

export {isValidAscii, isValidId, TransactionPointer, isTransactionPointer, TransactionInput, isTransactionInput, TransactionOutput, isTransactionOutput, getTransactionOutpoints, getTransactionInpoints}