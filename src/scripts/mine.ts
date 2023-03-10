import * as ed25519 from "@noble/ed25519";
import {canonicalize} from "json-canonicalize";
import {createHash} from "blake2";

let GENESIS_BLOCK = {
    "T": "00000000abc00000000000000000000000000000000000000000000000000000",
    "created": 1671062400,
    "miner": "Marabu",
    "nonce": "000000000000000000000000000000000000000000000000000000021bea03ed",
    "note": "The New York Times 2022-12-13: Scientists Achieve Nuclear Fusion Breakthrough With Blast of 192 Lasers",
    "previd": null,
    "txids": [],
    "type": "block"
  }

const DIFFICULTY = "1000000000000000000000000000000000000000000000000000000000000000"
const GENESIS_ID = "0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2"

let hash = (Math.pow(16, 100)).toString(16)

function compute_hash(obj) {
    // const t1 = Date.now();
    let h = createHash("blake2s")
    // console.log(`Hash time ${Date.now() - t1}`)
    // const t2 = Date.now();
    // h.update(Buffer.from(canonicalize(obj)))
    // Stringify for speed
    h.update(Buffer.from(JSON.stringify(obj)))
    // console.log(`Update time ${Date.now() - t2}`)
    // const t3 = Date.now();
    let hash : string = h.digest("hex")
    // console.log(`Digest time ${Date.now() - t3}`)
    return hash
}

function mine(obj, max_hashes=Infinity) {
    let nonce = parseInt(obj.nonce, 16)
    const difficulty = obj.T
    while((compute_hash(obj) > difficulty) && (max_hashes > 0)) {
        // const t1 = Date.now();
        let new_nonce = nonce.toString(16)
        // console.log(`To String time ${Date.now() - t1}`)
        // const t2 = Date.now();
        obj.nonce = "0".repeat(64-new_nonce.length) + new_nonce
        // console.log(`Add strings time ${Date.now() - t2}`)
        nonce += 1
        max_hashes -= 1
    }
    return obj
}

function create_block({
    T = DIFFICULTY,
    created = Date.now(),
    miner = "DEFINITELY_HONEST",
    note = "Our first block!",
    previd = GENESIS_ID,
    txids = [],
    type = "block"
} = {}) {
    let obj = {
        "T": T,
        "created": created,
        "miner": miner,
        "nonce": "0000000000000000000000000000000000000000000000000000000000000000",
        "note": note,
        "previd": previd,
        "txids": txids,
        "type": type
    }
    return mine(obj)
}

function create_coinbase_transaction({
    height = 1,
    outputs = [],
    type = "transaction"
} = {}) {
    return {
        "height":height,
        "outputs":outputs,
        "type":"transaction"
    }
}

function create_payment_transaction({
    inputs = [],
    outputs = [],
    type = "transaction"
} = {}) {
    return {
        "inputs": inputs, 
        "outputs": outputs,
        "type": type
    }
}

function print_object(obj) {
    console.log(canonicalize({"object": obj, "type": "object"}))
}

function get_canonical_uint8(obj) {
    return Uint8Array.from(Buffer.from(canonicalize(obj)))
}

function uint8_to_string(arr : Uint8Array) : string {
    return Buffer.from(arr).toString("hex")
}

async function sign_single_input_transaction(transaction_obj : any, private_key : Uint8Array) {
    let signature : string = uint8_to_string(await ed25519.sign(get_canonical_uint8(transaction_obj), private_key))
    transaction_obj.inputs[0].sig = signature
    return transaction_obj
}

// async function print_block(previd, timestamp=Date.now(), coinbase_height=1) {
//     // Create a new coinbase transaction paying a private key we know
//     let private_key = ed25519.utils.randomPrivateKey()
//     console.log(private_key)
//     let public_key = await ed25519.getPublicKey(private_key)
//     let coinbase_obj = {"height":coinbase_height,"outputs":[{"pubkey":Buffer.from(public_key).toString("hex"), "value":50*10**12}],"type":"transaction"}
//     console.log("Coinbase Transaction:")
//     console.log(JSON.stringify({"object": coinbase_obj, "type": "object"}))
//     let canonical_string = canonicalize(coinbase_obj)
//     let h = createHash("blake2s")
//     h.update(Buffer.from(canonical_string))
//     let coinbase_txid : string = h.digest("hex")
//     let NEW_BLOCK = {
//         "T": DIFFICULTY,
//         "created": timestamp,
//         "miner": "DEFINITELY_HONEST",
//         "nonce": "0000000000000000000000000000000000000000000000000000000000000000",
//         "note": "Our first block!",
//         "previd": previd,
//         "txids": [
//             coinbase_txid
//         ],
//         "type": "block"
//     }
//     let mined_obj = await mine(NEW_BLOCK)
//     console.log(`Here is a valid block with that transaction (extends genesis):`)
//     console.log(canonicalize({"object": mined_obj, "type": "object"}))
//     // Create a transaction that spends the previous coinbase
//     let spending_transaction_obj = {"inputs":[{"outpoint":{"index":0, "txid":coinbase_txid}, "sig":null}], "outputs":[{"pubkey":Buffer.from(public_key).toString("hex"), "value":500000}],"type":"transaction"}
//     canonical_string = canonicalize(spending_transaction_obj)
//     let signature = await ed25519.sign(Uint8Array.from(Buffer.from(canonical_string, 'utf-8')), private_key)
//     spending_transaction_obj["inputs"][0]["sig"] = Buffer.from(signature).toString("hex")
//     console.log(JSON.stringify({"object": spending_transaction_obj, "type": "object"}))
//     let new_prev_id = compute_hash(mined_obj)
//     let next_block = {
//         "T": DIFFICULTY,
//         "created": 1671148802,
//         "miner": "DEFINITELY_HONEST",
//         "nonce": "0000000000000000000000000000000000000000000000000000000000000000",
//         "note": "Our second block!",
//         "previd": new_prev_id,
//         "txids": [
//             compute_hash(spending_transaction_obj)
//         ],
//         "type": "block"
//     }
//     mined_obj = await mine(next_block)
//     console.log(`Here is a valid block with that transaction (extends 1st block):`)
//     console.log(canonicalize({"object": mined_obj, "type": "object"}))
// }

export {print_object, create_block, compute_hash, create_coinbase_transaction, create_payment_transaction, sign_single_input_transaction, mine, GENESIS_BLOCK, GENESIS_ID, DIFFICULTY}