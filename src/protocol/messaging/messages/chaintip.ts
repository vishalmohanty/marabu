import { get_from_height_db } from "../../../util/height_database";
import { MarabuSocket } from "../../../util/marabu_socket";
import { exists_in_db } from "../../../util/object_database";
import { BlockchainState } from "../../state/blockchain_state";
import { Message } from "../message_types/message";
import { create_get_object_message } from "./getobject";

interface ChaintipObject {
    type : string
    blockid : string
}

class ChaintipMessage extends Message {
    type : string = "chaintip"
    required_keys: string[] = ["type", "blockid"]
    obj : ChaintipObject

    _verify_message(): Boolean {
        return this.obj.blockid.length == 64
    }
    async _perform_validated_receive() {
        // If you already have the chaintip in database, you have already validated so set to new tip (if longest)
        if(await exists_in_db(this.obj.blockid)) {
            let new_height = await get_from_height_db(this.obj.blockid)
            if(new_height > this.blockchain_state.chain_length) {
                this.blockchain_state.chain_length = new_height
                this.blockchain_state.chaintip = this.obj.blockid
            }    
        }
        // Run get object on that chaintip
	else {
            create_get_object_message(this.socket, this.blockchain_state, this.obj.blockid).run_send_actions()
	}
    }
}

function create_chaintip_message(socket : MarabuSocket, blockchain_state : BlockchainState, blockid : string) {
    return new ChaintipMessage(socket, {"type": "chaintip", "blockid": blockid}, blockchain_state)
}

export {ChaintipMessage, create_chaintip_message}
