import { canonicalize } from "json-canonicalize";
import { Socket } from "net";
import { MarabuSocket } from "../../../util/marabu_socket";

class ErrorMessage {
    socket : MarabuSocket;
    name : string;
    message : string;

    constructor(socket : MarabuSocket, name : string, message : string) {
        this.socket = socket
        this.name = name;
        this.message = message
    }

    send() {
        let canonicalized_string : string = canonicalize(
            {
                "type": "error", 
                "name": this.name,
                "message": this.message
            }
        )
        console.log(`[sending] [${this.socket.socket.remoteAddress}:${this.socket.socket.remotePort}] ${canonicalized_string}`)
        this.socket.send(canonicalized_string, true)
    }
    
}

export {ErrorMessage}