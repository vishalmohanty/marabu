import { NonvolatileState } from "./nonvolatile";


class BlockchainState {
    peers : NonvolatileState<Array<string>>
    constructor(backing_file_name : string) {
        this.peers = new NonvolatileState(backing_file_name, "peers")
    }
    get_peers() : Array<string> {
        return this.peers.read()
    }
    add_peer(peer : string) {
        let peers = new Set(this.get_peers())
        peers.add(peer)
        this.peers.set(Array.from(peers))
    }
}

export {BlockchainState}