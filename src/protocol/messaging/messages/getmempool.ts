import { BlockchainState } from "../../state/blockchain_state";
import {MarabuSocket} from "../../../util/marabu_socket"
import { Message } from "../message_types/message";
import {create_mempool_message} from "../messages/mempool";

interface GetMempoolObject {
    type : string
}

class GetMempoolMessage extends Message {
    type : string = "getmempool"
    required_keys : Array<string> = ["type"]
    obj : GetMempoolObject

    _verify_message(): Boolean {
        return true
    }

    async _perform_validated_receive() {
        // Send mempool
        (create_mempool_message(this.socket, this.blockchain_state)).run_send_actions()
    }
}

function create_get_mempool_message(socket : MarabuSocket, blockchain_state : BlockchainState) {
    return new GetMempoolMessage(socket, {"type": "getmempool"}, blockchain_state)
}

export {GetMempoolMessage, create_get_mempool_message}