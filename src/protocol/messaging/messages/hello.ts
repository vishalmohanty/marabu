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
        if(!(version.slice(0, 5) == "0.10.") || isNaN(Number(version.slice(5)))) {
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
    return new HelloMessage(socket, {"type": "hello",  "version": "0.10.0", "agent": NAME}, blockchain_state)
}

export {HelloMessage, create_hello_message}


// {"type": "object", "object": {"height":0,"outputs":[{"pubkey":"958f8add086cc348e229a3b6590c71b7d7754e42134a127a50648bf07969d9a0","value":50000000000}],"type":"transaction"}}

// {"type": "object", "object": {"inputs":[{"outpoint":{"index":0,"txid":"b303d841891f91af118a319f99f5984def51091166ac73c062c98f86ea7371ee"},"sig":"060bf7cbe141fecfebf6dafbd6ebbcff25f82e729a7770f4f3b1f81a7ec8a0ce4b287597e609b822111bbe1a83d682ef14f018f8a9143cef25ecc9a8b0c1c405"}],"outputs":[{"pubkey":"958f8add086cc348e229a3b6590c71b7d7754e42134a127a50648bf07969d9a0","value":10}],"type":"transaction"}}