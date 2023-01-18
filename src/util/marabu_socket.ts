import { Socket } from "net";

class MarabuSocket {
    socket : Socket
    constructor(socket : Socket) {
        this.socket = socket
    }
    send(content : string, disconnect : Boolean = false) {
        if(disconnect) {
            this.socket.write(content, () => {this.socket.destroy()})
        } else {
            this.socket.write(content)
        }
    }
}

export {MarabuSocket}