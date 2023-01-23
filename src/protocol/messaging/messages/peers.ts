import { isIP } from "net";
import { BlockchainState } from "../../state/blockchain_state";
import isValidDomain from 'is-valid-domain';
import {MarabuSocket} from "../../../util/marabu_socket"
import { Message } from "../message_types/message";

interface PeersObject {
    type: string,
    peers : Array<string>,
}

class PeersMessage extends Message {
    type : string = "peers"
    required_keys : Array<string> = ["type", "peers"]
    obj : PeersObject;


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

    async _perform_validated_receive() {
        for(const peer of this.obj["peers"]) {
            if (this._is_valid_peer(peer)) {
                this.blockchain_state.add_peer(peer)
            }
        }
    }
}

function create_peers_message(socket : MarabuSocket, blockchain_state : BlockchainState, peers : Array<string>) {
    return new PeersMessage(socket, {"type": "peers", "peers": peers}, blockchain_state)
}

export {PeersMessage, create_peers_message}