import {Socket} from "net";
import {Message} from "./message";

abstract class ReplyMessage extends Message {
    _perform_validated_receive() {
        this._reply()
    }
    abstract _reply()
}

export {ReplyMessage}