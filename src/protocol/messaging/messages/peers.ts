import { Socket, isIP } from "net";
import { BlockchainState } from "../../state/blockchain_state";
import { StateMessage } from "../message_types/state_message";
import isValidDomain from 'is-valid-domain';

class PeersMessage extends StateMessage {
    type : string = "peers"
    required_keys : Array<string> = ["type", "peers"]

    _verify_message() : Boolean {
        return true
    }

    _is_valid_peer(peer: string): Boolean {
        const ip = peer.split(":")[0]
        if (isIP(ip) || isValidDomain(ip)) {
            return true
        }
        return false
    }

    _update_state() {
        var remoteAddress = this.socket.remoteAddress;
        console.log(`[peers] Got peers ${this.obj["peers"]} from ${remoteAddress}`)
        for(const peer of this.obj["peers"]) {
            if (this._is_valid_peer(peer)) {
                this.blockchain_state.add_peer(peer)
            }
        }
    }
}

function create_peers_message(socket : Socket, blockchain_state : BlockchainState, peers : Array<string>) {
    return new PeersMessage(socket, {"type": "peers", "peers": peers}, blockchain_state)
}

export {PeersMessage, create_peers_message}