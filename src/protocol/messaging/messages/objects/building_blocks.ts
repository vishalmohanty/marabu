let hex_chars = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"])

function is_all_hex(s : string) {
    return Array.from(s).every((val) => hex_chars.has(val))
}

interface TransactionPointer {
    txid : string,
    index : number
}
// User-defined type guard
function isTransactionPointer(obj : any) : obj is TransactionPointer {
    return obj && (typeof obj.txid == "string") && (obj.txid.length == 64) && (is_all_hex(obj.txid)) && (typeof obj.index == "number") && (obj.index >= 0)
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

export {TransactionPointer, isTransactionPointer, TransactionInput, isTransactionInput, TransactionOutput, isTransactionOutput}