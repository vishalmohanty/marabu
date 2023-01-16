import {GetPeersMessage} from "./messages/getpeers"
import {PeersMessage} from "./messages/peers"
import {HelloMessage} from "./messages/hello"

let selector = {
    "getpeers": GetPeersMessage,
    "peers": PeersMessage,
    "hello": HelloMessage
}

export {selector};