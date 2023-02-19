import { gossip } from "../../../util/gossip";
import { MarabuSocket } from "../../../util/marabu_socket";
import { BlockchainState } from "../../state/blockchain_state";
import { Message } from "../message_types/message";
import { ErrorMessage } from "./error"
import { create_i_have_object_message } from "./ihaveobject";
import {object_selector} from "./objects/object_selector"
import { MarabuObject } from "./objects/object_type";

interface ObjectObject {
    type: string,
    object : any
}

class ObjectMessage extends Message {
    type : string = "object"
    required_keys : Array<string> = ["type", "object"]
    obj : ObjectObject
    _verify_message(): Boolean {
        if(this.obj.object.type == undefined) {
            (new ErrorMessage(this.socket, "INVALID_FORMAT", `Object does not have type field.`)).send()
            return false
        }
        if(object_selector(this.obj.object) == undefined) {
            (new ErrorMessage(this.socket, "INVALID_FORMAT", `Can't parse as any object.`)).send()
            return false
        }
        return true
    }
    async _perform_validated_receive() {
        // Object lifecycle
        let selected_class = object_selector(this.obj.object)
        let marabu_object = new selected_class(this.socket, this.obj.object, this.blockchain_state)
        let prereqs_complete = await marabu_object.complete_prereqs()
        if(!prereqs_complete) {
            // Prereqs not complete so don't run receive
            return
        }
        let added : Boolean = await marabu_object.run_receive()
        if(added) {
            gossip(create_i_have_object_message, this.blockchain_state, MarabuObject.get_object_id(this.obj.object))
        }
    }
}

function create_object_message(socket : MarabuSocket, blockchain_state : BlockchainState, obj: any) {
    return new ObjectMessage(socket, {"type": "object",  "object": obj}, blockchain_state)
}

export {ObjectMessage, create_object_message}



// {"object":{"height":0,"outputs":[{"pubkey":"8dbcd2401c89c04d6e53c81c90aa0b551cc8fc47c0469217c8f5cfbae1e911f9", "value":50000000000}],"type":"transaction"},"type":"object"}

//  {"object":{"inputs":[{"outpoint":{"index":0, "txid":"1bb37b637d07100cd26fc063dfd4c39a7931cc88dae3417871219715a5e374af"}, "sig":"1d0d7d774042607c69a87ac5f1cdf92bf474c25fafcc089fe667602bfefb0494726c519e92266957429ced875256e6915eb8cea2ea66366e739415efc47a6805"}], "outputs":[{"pubkey":"8dbcd2401c89c04d6e53c81c90aa0b551cc8fc47c0469217c8f5cfbae1e911f9", "value":10}],"type":"transaction"},"type":"object"}