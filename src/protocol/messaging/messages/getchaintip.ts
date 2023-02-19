import { BlockchainState } from "../../state/blockchain_state";
import {MarabuSocket} from "../../../util/marabu_socket"
import { Message } from "../message_types/message";
import {create_chaintip_message} from "../messages/chaintip";

interface GetChaintipObject {
    type : string
}

class GetChaintipMessage extends Message {
    type : string = "getchaintip"
    required_keys : Array<string> = ["type"]
    obj : GetChaintipObject

    _verify_message(): Boolean {
        return true
    }

    async _perform_validated_receive() {
        // Give chain tip
        (create_chaintip_message(this.socket, this.blockchain_state, this.blockchain_state.chaintip)).run_send_actions()
    }
}

function create_get_chaintip_message(socket : MarabuSocket, blockchain_state : BlockchainState) {
    return new GetChaintipMessage(socket, {"type": "getchaintip"}, blockchain_state)
}

export {GetChaintipMessage, create_get_chaintip_message}