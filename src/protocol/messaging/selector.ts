import {GetPeersMessage} from "./messages/getpeers"
import {PeersMessage} from "./messages/peers"
import {HelloMessage} from "./messages/hello"
import {ObjectMessage} from "./messages/object"
import { Message } from "./message_types/message";

class StubMessage extends Message {
    type: string = "STUB";
    required_keys: string[] = ["type"]
    _verify_message(): Boolean {
        return true
    }
    _perform_validated_receive() {
        return
    }
}

let selector = {
    "getpeers": GetPeersMessage,
    "peers": PeersMessage,
    "hello": HelloMessage,
    "object": ObjectMessage,
    "getmempool": StubMessage,
    "getchaintip": StubMessage
}

export {selector};