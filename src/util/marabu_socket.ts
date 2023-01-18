import { Socket } from "net";

class MarabuSocket {
    socket : Socket
    handshake_completed : Boolean
    constructor(socket : Socket) {
        this.socket = socket
        this.handshake_completed = false
    }
    send(content : string, error=false) {
        if(!this.handshake_completed && error) {
            this.socket.write(content, () => {this.socket.destroy()})
        } else {
            this.socket.write(content)
        }
    }
}

export {MarabuSocket}