import { Socket } from "net";
import { TransactionPointer } from "../messaging/messages/objects/building_blocks";
import { NonvolatileState } from "./nonvolatile";


class BlockchainState {
    peers : NonvolatileState<Array<string>>
    chaintip : string
    chain_length : number
    objectid_handled : Set<String>
    mempool: Array<string>
    mempool_state: Set<string>
    golang_socket : Socket
    constructor(backing_file_name : string) {
        this.peers = new NonvolatileState(backing_file_name, "peers")
        // Start out with genesis
        this.chaintip = "0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2"
        this.chain_length = 0
        this.objectid_handled = new Set()
        this.mempool = new Array<string>()
        this.mempool_state = new Set()
        this.golang_socket = null
    }
    get_peers() : Array<string> {
        // TEMPORARY: Only solution peer
        return this.peers.read()
    }
    add_peer(peer : string) {
        let peers = new Set(this.get_peers())
        if (!peers.has(peer)) {
            peers.add(peer)
            this.peers.set(Array.from(peers))
        }
    }
}

export {BlockchainState}