import { get_from_height_db } from "../../../util/height_database";
import { MarabuSocket } from "../../../util/marabu_socket";
import { exists_in_db } from "../../../util/object_database";
import { BlockchainState } from "../../state/blockchain_state";
import { Message } from "../message_types/message";
import { create_get_object_message } from "./getobject";
import { isValidId } from "./objects/building_blocks"

interface MempoolObject {
    type : string
    txids : Array<string>
}

class MempoolMessage extends Message {
    type : string = "mempool"
    required_keys: string[] = ["type", "txids"]
    obj : MempoolObject

    _verify_message(): Boolean {
        return this.obj.txids.every((txid) => isValidId(txid));
    }

    async _perform_validated_receive() {
        for (const txid of this.obj.txids) {
            // Run get_object if the transaction is not in DB
            create_get_object_message(this.socket, this.blockchain_state, txid).run_send_actions()
        }
    }
}

function create_mempool_message(socket : MarabuSocket, blockchain_state : BlockchainState) {
    return new MempoolMessage(socket, {"type": "mempool", "txids": blockchain_state.mempool}, blockchain_state)
}

export {MempoolMessage, create_mempool_message}
