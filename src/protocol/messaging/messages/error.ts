import { canonicalize } from "json-canonicalize";
import { Socket } from "net";

class ErrorMessage {
    socket : Socket;
    name : string;
    message : string;

    constructor(socket : Socket, name : string, message : string) {
        this.socket = socket
        this.name = name;
        this.message = message
    }

    send() {
        console.log("SENDING ERROR", this.name, this.message)
        this.socket.write(canonicalize(
            {
                "type": "error", 
                "name": this.name,
                "message": this.message
            }
        ))
    }
    
}

export {ErrorMessage}