import {GENESIS_BLOCK, create_block, DIFFICULTY, GENESIS_ID, mine} from "./mine"

function measure() {
    // Choose random from (0, 2^256-1)
    let nonce : string = (Math.random()*Math.pow(2, 256)).toString(16)
    console.log(`Starting nonce ${nonce}`)
    GENESIS_BLOCK.nonce = "0".repeat(64-nonce.length) + nonce
    mine(GENESIS_BLOCK, 1000000)
    console.log(`Ending nonce ${GENESIS_BLOCK.nonce}`)
}

measure()