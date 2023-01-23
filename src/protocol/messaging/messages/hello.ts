import { BlockchainState } from "../../state/blockchain_state";
import { ErrorMessage } from "./error"
import {MarabuSocket} from "../../../util/marabu_socket"
import { Message } from "../message_types/message";

let NAME = "DEFINITELY_HONEST"

interface HelloObject {
    type: string,
    version : string,
    agent? : string
}

class HelloMessage extends Message {
    type : string = "hello"
    required_keys : Array<string> = ["type", "version"]
    obj : HelloObject
    _verify_message(): Boolean {
        // Checks 
        let version = this.obj.version;
        if(!(version.slice(0, 4) == "0.9.") || isNaN(Number(version.slice(4)))) {
            (new ErrorMessage(this.socket, "INVALID_FORMAT", "Unexpected version number.")).send()
            return false
        }
        return true
    }
    async _perform_validated_receive() {
        create_hello_message(this.socket, this.blockchain_state).run_send_actions()
    }
}

function create_hello_message(socket : MarabuSocket, blockchain_state : BlockchainState) {
    return new HelloMessage(socket, {"type": "hello",  "version": "0.9.0", "agent": NAME}, blockchain_state)
}

export {HelloMessage, create_hello_message}