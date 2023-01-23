import { Socket } from "net";
import { active_peers } from "./gossip"

class MarabuSocket {
    socket : Socket
    constructor(socket : Socket) {
        this.socket = socket
        active_peers.add(this)
    }
    send(content : string, disconnect : Boolean = false) {
        if(disconnect) {
            active_peers.delete(this)
            this.socket.write(content, () => {this.socket.destroy()})
        } else {
            this.socket.write(content)
        }
    }
}

export {MarabuSocket}