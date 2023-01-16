import { Socket } from "net";
import {Message} from "./message";
import {BlockchainState} from "../../state/blockchain_state"

abstract class StateMessage extends Message {
    _perform_validated_receive() {
        this._update_state()
    }
    abstract _update_state()
}

export {StateMessage}