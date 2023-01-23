import { BlockchainState } from "../../state/blockchain_state";
import {MarabuSocket} from "../../../util/marabu_socket"
import { Message } from "../message_types/message";
import { get_from_db } from "../../../util/database";
import {create_get_object_message} from "./getobject"

interface IHaveObject {
    type : string,
    objectid : string
}

class IHaveObjectMessage extends Message {
    type : string = "ihaveobject"
    required_keys : Array<string> = ["type", "objectid"]
    obj : IHaveObject

    _verify_message(): Boolean {
        return true
    }
    async _perform_validated_receive() {
        // TODO: Request object if you don't have it.
        get_from_db(this.obj.objectid).then((present) => {if(present) {create_get_object_message(this.socket, this.blockchain_state, this.obj.objectid).run_send_actions()}})
    }

}

function create_i_have_object_message(socket : MarabuSocket, blockchain_state : BlockchainState, objectid : string) {
    return new IHaveObjectMessage(socket, {"type": "ihaveobject", "objectid": objectid}, blockchain_state)
}

export {IHaveObjectMessage, create_i_have_object_message}

