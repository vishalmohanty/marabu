import { Socket } from "net";
import { ErrorMessage } from "../protocol/messaging/messages/error";

const TIMEOUT : number = 10000 // Timeout to receive a valid message

class JSONDefragmenter {
    buffer : string;
    socket : Socket;
    counter : number;
    timeoutID : NodeJS.Timeout;

    constructor(socket : Socket) {
        this.buffer = ""
        this.socket = socket
        // Counter helps us keep track of the fragment of message. 
        // Timer is started only on the first character of a new message
        this.counter = 0
        this.timeoutID = null
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
                // Reset the timer when we get any fully formed message (terminated by '\n')
                clearTimeout(this.timeoutID);
                this.counter = 0;
            } else {
                if (this.counter == 0) {
                    this.counter += 1
                    // Start a timer on receiving the first fragment. On timing out, close connection
                    this.timeoutID = setTimeout(() => {
                        (
                            new ErrorMessage(this.socket, "INVALID_FORMAT", "Timed out waiting to receive a valid message.")).send(() => {
                                console.log(`Timed out waiting to receive a valid message. Terminated connection with ${this.socket.remoteAddress}`)
                                this.socket.destroy()
                                return null
                            }
                        )
                    }, TIMEOUT);
                }
                this.buffer += String.fromCharCode(val)
            }
        }
        return null
    }
}

export {JSONDefragmenter}