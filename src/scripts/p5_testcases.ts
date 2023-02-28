import { print_object, create_block, create_coinbase_transaction, compute_hash, create_payment_transaction, sign_single_input_transaction, GENESIS_BLOCK } from "./mine"
import * as ed25519 from "@noble/ed25519";

function pubkey_to_string(key : Uint8Array) {
    return Buffer.from(key).toString("hex")
}

async function run() {
    let private_key : Uint8Array = ed25519.utils.randomPrivateKey()
    let public_key : Uint8Array = await ed25519.getPublicKey(private_key)
    console.log("Genesis:")
    print_object(GENESIS_BLOCK)
    console.log("Coinbase transaction")
    let coinbase_1 = create_coinbase_transaction({height:1, outputs: [{
        pubkey: pubkey_to_string(public_key),
        value: 50000000000
    }]})
    print_object(coinbase_1)
    console.log("Block 1")
    let block_1 = create_block({ previd: compute_hash(GENESIS_BLOCK), txids: [compute_hash(coinbase_1)], created: Date.now()/1000})
    print_object(block_1)
    console.log("Transaction for mempool (should be added)")
    let transaction_1 = create_payment_transaction({inputs : [{"outpoint": {"txid": compute_hash(coinbase_1), "index": 0}, "sig": null}], outputs: [{"pubkey": pubkey_to_string(public_key), "value": 40000000000}]})
    transaction_1 = await sign_single_input_transaction(transaction_1, private_key)
    print_object(transaction_1)
    console.log("Transaction for mempool (should not be added)")
    let transaction_2 = create_payment_transaction({inputs : [{"outpoint": {"txid": compute_hash(coinbase_1), "index": 0}, "sig": null}], outputs: [{"pubkey": pubkey_to_string(public_key), "value": 30000000000}]})
    transaction_2 = await sign_single_input_transaction(transaction_2, private_key)
    print_object(transaction_2)

    console.log("====== Add a new block that conflicts and empties the mempool")
    let block_2 = create_block({ previd: compute_hash(block_1), txids: [compute_hash(transaction_2)], created: Date.now()/1000})
    print_object(block_2)

    console.log("======== Create new fork to reorg")
    
    let block_3 = create_block({ previd: compute_hash(block_1), txids: [], created: Date.now()/1000})
    print_object(block_3)
    let block_4 = create_block({ previd: compute_hash(block_3), txids: [], created: Date.now()/1000})
    print_object(block_4)
}

run()