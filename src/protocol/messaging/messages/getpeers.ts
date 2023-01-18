import { Socket } from "net";
import { BlockchainState } from "../../state/blockchain_state";
import { ReplyMessage } from "../message_types/reply_message";
import {create_peers_message} from "./peers"
import {MarabuSocket} from "../../../util/marabu_socket"

class GetPeersMessage extends ReplyMessage {
    type : string = "getpeers"
    required_keys : Array<string> = ["type"]

    _verify_message(): Boolean {
        return true
    }
    _reply() {
        let peers = this.blockchain_state.get_peers()
        create_peers_message(this.socket, this.blockchain_state, peers).run_send_actions()
    }

}

function create_get_peers_message(socket : MarabuSocket, blockchain_state : BlockchainState) {
    return new GetPeersMessage(socket, {"type": "getpeers"}, blockchain_state)
}

export {GetPeersMessage, create_get_peers_message}