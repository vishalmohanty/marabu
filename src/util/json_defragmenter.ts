import { Socket } from "net";
import { ErrorMessage } from "../protocol/messaging/messages/error";

class JSONDefragmenter {
    buffer : string;
    socket : Socket;

    constructor(socket : Socket) {
        this.buffer = ""
        this.socket = socket
    }
    *feed(buf : Buffer) {
        for(const val of buf) {
            if(val == 0x0A) {
                try {
                    yield JSON.parse(this.buffer)
                } catch(error) {
                    (new ErrorMessage(this.socket, "INVALID_FORMAT", "Not parsable as json.")).send()
                }
                this.buffer = ""
            } else {
                this.buffer += String.fromCharCode(val)
            }
        }
        return null
    }
}

export {JSONDefragmenter}