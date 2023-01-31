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

function compute_hash(obj) {
    let h = createHash("blake2s")
    h.update(Buffer.from(canonicalize(obj)))
    let hash : string = h.digest("hex")
    return hash
}

function mine(obj) {
    while(compute_hash(obj) > obj.T) {
        let new_nonce = (parseInt(obj.nonce, 16) + 1).toString(16)
        obj.nonce = "0".repeat(64-new_nonce.length) + new_nonce
    }
    console.log(compute_hash(obj), obj.T)
    return obj
}

async function main() {
    // Create a new coinbase transaction paying a private key we know
    let private_key = ed25519.utils.randomPrivateKey()
    console.log(private_key)
    let public_key = await ed25519.getPublicKey(private_key)
    let coinbase_obj = {"height":0,"outputs":[{"pubkey":Buffer.from(public_key).toString("hex"), "value":50*10**12}],"type":"transaction"}
    console.log("Coinbase Transaction:")
    console.log(JSON.stringify({"object": coinbase_obj, "type": "object"}))
    let canonical_string = canonicalize(coinbase_obj)
    let h = createHash("blake2s")
    h.update(Buffer.from(canonical_string))
    let coinbase_txid : string = h.digest("hex")
    let genesis_hash = createHash("blake2s")
    genesis_hash.update(Buffer.from(canonicalize(GENESIS_BLOCK)))
    let genesis_id = genesis_hash.digest("hex")
    let NEW_BLOCK = {
        "T": DIFFICULTY,
        "created": 1671148801,
        "miner": "DEFINITELY_HONEST",
        "nonce": "0000000000000000000000000000000000000000000000000000000000000000",
        "note": "Our first block!",
        "previd": genesis_id,
        "txids": [
            coinbase_txid
        ],
        "type": "block"
    }
    let mined_obj = await mine(NEW_BLOCK)
    console.log(`Here is a valid block with that transaction (extends genesis):`)
    console.log(canonicalize({"object": mined_obj, "type": "object"}))
    // Create a transaction that spends the previous coinbase
    let spending_transaction_obj = {"inputs":[{"outpoint":{"index":0, "txid":coinbase_txid}, "sig":null}], "outputs":[{"pubkey":Buffer.from(public_key).toString("hex"), "value":500000}],"type":"transaction"}
    canonical_string = canonicalize(spending_transaction_obj)
    let signature = await ed25519.sign(Uint8Array.from(Buffer.from(canonical_string, 'utf-8')), private_key)
    spending_transaction_obj["inputs"][0]["sig"] = Buffer.from(signature).toString("hex")
    console.log(JSON.stringify({"object": spending_transaction_obj, "type": "object"}))
    let new_prev_id = compute_hash(mined_obj)
    let next_block = {
        "T": DIFFICULTY,
        "created": 1671148802,
        "miner": "DEFINITELY_HONEST",
        "nonce": "0000000000000000000000000000000000000000000000000000000000000000",
        "note": "Our second block!",
        "previd": new_prev_id,
        "txids": [
            compute_hash(spending_transaction_obj)
        ],
        "type": "block"
    }
    mined_obj = await mine(next_block)
    console.log(`Here is a valid block with that transaction (extends 1st block):`)
    console.log(canonicalize({"object": mined_obj, "type": "object"}))
}

main()

// Genesis: {"type": "object", "object": {"T":"00000000abc00000000000000000000000000000000000000000000000000000","created":1671062400,"miner":"Marabu","nonce":"000000000000000000000000000000000000000000000000000000021bea03ed","note":"The New York Times 2022-12-13: Scientists Achieve Nuclear Fusion Breakthrough With Blast of 192 Lasers","previd":null,"txids":[],"type":"block"}}