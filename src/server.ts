import {Server, Socket} from "net";
import {JSONDefragmenter} from "./util/json_defragmenter"
import {ErrorMessage} from "./protocol/messaging/messages/error"
import {selector} from "./protocol/messaging/selector"
import { Message } from "./protocol/messaging/message_types/message";
import { BlockchainState } from "./protocol/state/blockchain_state";
import { create_hello_message, HelloMessage } from "./protocol/messaging/messages/hello";
import { create_get_peers_message } from "./protocol/messaging/messages/getpeers";

let PORT : Number = 18018
let BACKING_FILE_NAME : string = "src/protocol/state/data.json"

let server = new Server()
let blockchain_state : BlockchainState = new BlockchainState(BACKING_FILE_NAME)
server.listen(PORT, () => `Listening on port ${PORT}`)

function run_initial_checks(socket : Socket, defragmented) : Boolean {
    if(defragmented.type === undefined) {
        (new ErrorMessage(socket, "INVALID_FORMAT", "No type field found in json.")).send()
        return false
    } 
    let selected_class = selector[defragmented.type]
    if(selected_class == undefined) {
        // Sending this error message causes a termination in connection
        // (new ErrorMessage(socket, "INVALID_FORMAT", `Invalid message type ${defragmented.type}`)).send()
        return false
    }
    return true
}

server.on("connection", function(socket : Socket) {
    let json_defragmenter = new JSONDefragmenter(socket);
    let handshake_completed = false
    socket.on('data', function(chunk : Buffer) {
        for(const defragmented of json_defragmenter.feed(chunk)) {
            if(!run_initial_checks(socket, defragmented)) {
                continue
            }
            let selected_class = selector[defragmented.type]
            let message : Message = new selected_class(socket, defragmented, blockchain_state)
            if(!handshake_completed) {
                if(defragmented.type != "hello") {
                    // Only want to terminate with invalid handshake if you get a different valid message before hello
                    if(message._all_keys_exist(defragmented) || message._verify_message()) {
                        (new ErrorMessage(socket, "INVALID_HANDSHAKE", "Handshake not complete.")).send(() => socket.destroy())
                        return
                    }
                }
            }
            handshake_completed = true
            message.run_receive_actions()
        }
    }
)})

for(const peer of blockchain_state.get_peers()) {
    let peers_split : Array<string> = peer.split(":")
    let host_ip : string = peers_split.slice(0, -1).join("")
    let port : number = parseInt(peers_split[peers_split.length-1])
    let client_socket : Socket = new Socket()
    let handshake_completed : Boolean = false
    let json_defragmenter = new JSONDefragmenter(client_socket);
    client_socket.connect({port : port, host : host_ip}, function() {
        create_hello_message(client_socket, blockchain_state).run_send_actions()
    })
    client_socket.on("data", function(chunk) {
        for(const defragmented of json_defragmenter.feed(chunk)) {
            console.log(`[server] Received ${defragmented.type} from ${client_socket.remoteAddress}`)
            if(!run_initial_checks(client_socket, defragmented)) {
                continue
            }
            if(!handshake_completed) {
                if(defragmented.type != "hello") {
                    (new ErrorMessage(client_socket, "INVALID_HANDSHAKE", "Handshake not complete.")).send()
                    continue
                }
                let hello_message = new HelloMessage(client_socket, defragmented, blockchain_state)
                if(!hello_message._verify_message()) {
                    continue
                }

                handshake_completed = true
                create_get_peers_message(client_socket, blockchain_state).run_send_actions()
                continue
            } else {
                let selected_class = selector[defragmented.type]
                let message : Message = new selected_class(client_socket, defragmented, blockchain_state)
                message.run_receive_actions()
            }
        }
    })
}