import { BlockchainState } from "../../state/blockchain_state";
import {create_peers_message} from "./peers"
import {MarabuSocket} from "../../../util/marabu_socket"
import { Message } from "../message_types/message";
import { exists_in_db, get_from_db } from "../../../util/database";
import { ErrorMessage } from "./error";

interface GetObject {
    type : string,
    objectid : string
}

class GetObjectMessage extends Message {
    type : string = "getobject"
    required_keys : Array<string> = ["type", "objectid"]
    obj : GetObject

    _verify_message(): Boolean {
        return true
    }
    async _perform_validated_receive() {
        if(!await exists_in_db(this.obj.objectid)) {
            (new ErrorMessage(this.socket, "UNFINDABLE_OBJECT", "Object not found")).send()
            return false
        }
        let s : string = await get_from_db(this.obj.objectid)
        create_get_object_message(this.socket, this.blockchain_state, JSON.parse(s)).run_send_actions()
    }

}

function create_get_object_message(socket : MarabuSocket, blockchain_state : BlockchainState, objectid : string) {
    return new GetObjectMessage(socket, {"type": "getobject", "objectid": objectid}, blockchain_state)
}

export {GetObjectMessage, create_get_object_message}