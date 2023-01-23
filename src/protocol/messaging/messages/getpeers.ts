import { BlockchainState } from "../../state/blockchain_state";
import {create_peers_message} from "./peers"
import {MarabuSocket} from "../../../util/marabu_socket"
import { Message } from "../message_types/message";

interface GetPeersObject {
    type : string
}

class GetPeersMessage extends Message {
    type : string = "getpeers"
    required_keys : Array<string> = ["type"]
    obj : GetPeersObject

    _verify_message(): Boolean {
        return true
    }
    async _perform_validated_receive() {
        let peers = this.blockchain_state.get_peers()
        create_peers_message(this.socket, this.blockchain_state, peers).run_send_actions()
    }

}

function create_get_peers_message(socket : MarabuSocket, blockchain_state : BlockchainState) {
    return new GetPeersMessage(socket, {"type": "getpeers"}, blockchain_state)
}

export {GetPeersMessage, create_get_peers_message}