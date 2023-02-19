import { print_object, create_block, create_coinbase_transaction, compute_hash } from "./mine"

const GENESIS_ID = "0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2"

async function main() {
    // a) A blockchain that points to an unavailable block
    console.log("Test Case 1")
    // await print_block("abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd")
    let block = await create_block({previd : "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd"})
    print_object(block)
    console.log("---------------------------------------------")
    // b) A blockchain with non-increasing timestamps
    console.log("Test Case 2")
    block = await create_block({created : 0})
    print_object(block)
    console.log("---------------------------------------------")
    // c) A blockchain with a block in the year 2077
    console.log("Test Case 3")
    block = await create_block({created : Date.UTC(2077, 1, 1)})
    print_object(block)
    console.log("---------------------------------------------")
    // d) A blockchain with an invalid proof-of-work in one of the blocks
    console.log("Test Case 4")
    block = await create_block({})
    // Odds (15/16) are that this won't satsfy PoW
    block["nonce"] = "0000000000000000000000000000000000000000000000000000000000000000"
    print_object(block)
    let second_block = await create_block({previd : compute_hash(block)})
    print_object(second_block)
    
    console.log("---------------------------------------------")
    // e) A blockchain that does not go back to the real genesis but stops at a different genesis
    // (with valid PoW but a null previd)
    console.log("Test Case 5")
    let coinbase_tx = create_coinbase_transaction({height : 0})
    print_object(coinbase_tx)
    block = create_block({txids : [compute_hash(coinbase_tx)]})
    print_object(block)
    console.log("---------------------------------------------")
    

    // f) A blockchain with an incorrect height in the coinbase transaction in a block
    console.log("Test Case 6")
    block = await create_block({previd : null})
    print_object(block)
    console.log("---------------------------------------------")
}

main()