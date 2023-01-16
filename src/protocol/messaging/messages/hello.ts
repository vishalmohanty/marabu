import { Socket } from "net";
import { BlockchainState } from "../../state/blockchain_state";
import { ReplyMessage } from "../message_types/reply_message";
import { ErrorMessage } from "./error"

let NAME = "DEFINITELY_HONEST"

class HelloMessage extends ReplyMessage {
    type : string = "hello"
    required_keys : Array<string> = ["type", "version"]
    _verify_message(): Boolean {
        // Checks 
        let version = this.obj.version;
        if(!(version.slice(0, 4) == "0.9.") || isNaN(Number(version.slice(4)))) {
            (new ErrorMessage(this.socket, "INVALID_FORMAT", "Unexpected version number.")).send()
            return false
        }
        return true
    }
    _reply() {
        create_hello_message(this.socket, this.blockchain_state).run_send_actions()
    }
}

function create_hello_message(socket : Socket, blockchain_state : BlockchainState) {
    return new HelloMessage(socket, {"type": "hello",  "version": "0.9.0", "agent": NAME}, blockchain_state)
}

export {HelloMessage, create_hello_message}