import { Socket } from "net";
import { BlockchainState } from "../../state/blockchain_state";
import { StateMessage } from "../message_types/state_message";

class PeersMessage extends StateMessage {
    type : string = "peers"
    required_keys : Array<string> = ["type", "peers"]

    _verify_message() : Boolean {
        return true
    }
    _update_state() {
        console.log(`Got peers ${this.obj["peers"]}`)
        for(const peer of this.obj["peers"]) {
            this.blockchain_state.add_peer(peer)
        }
    }
}

function create_peers_message(socket : Socket, blockchain_state : BlockchainState, peers : Array<string>) {
    return new PeersMessage(socket, {"type": "peers", "peers": peers}, blockchain_state)
}

export {PeersMessage, create_peers_message}