import {GetPeersMessage} from "./messages/getpeers"
import {PeersMessage} from "./messages/peers"
import {HelloMessage} from "./messages/hello"
import {ObjectMessage} from "./messages/object"
import {GetObjectMessage} from "./messages/getobject"
import {IHaveObjectMessage} from "./messages/ihaveobject"
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
    "getobject": GetObjectMessage,
    "ihaveobject": IHaveObjectMessage,
    "getmempool": StubMessage,
    "getchaintip": StubMessage,
    "error": StubMessage
}

export {selector};

// {"object":{"T":"1000000000000000000000000000000000000000000000000000000000000000","created":1671148801,"miner":"DEFINITELY_HONEST","nonce":"0000000000000000000000000000000000000000000000000000000000000005","note":"Our first block!","previd":"89cbf14a631a3e8593ff7e52e69913b97527b090cc8af7b7a63c4ccf7b18c0e0","txids":["19886066106320fa79c5dbee2a3fa0ecdae5eb6022b979e47eb8bce945d9bf22"],"type":"block"},"type":"object"}