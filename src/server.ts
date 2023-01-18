import {Server, Socket} from "net";
import {JSONDefragmenter} from "./util/json_defragmenter"
import {ErrorMessage} from "./protocol/messaging/messages/error"
import {selector} from "./protocol/messaging/selector"
import { Message } from "./protocol/messaging/message_types/message";
import { BlockchainState } from "./protocol/state/blockchain_state";
import { create_hello_message, HelloMessage } from "./protocol/messaging/messages/hello";
import { create_get_peers_message } from "./protocol/messaging/messages/getpeers";
import { MarabuSocket } from "./util/marabu_socket";

let PORT : Number = 18018
let BACKING_FILE_NAME : string = "src/protocol/state/data.json"

let server = new Server()
let blockchain_state : BlockchainState = new BlockchainState(BACKING_FILE_NAME)
server.listen(PORT, () => `Listening on port ${PORT}`)

function run_initial_checks(socket : MarabuSocket, defragmented) : Boolean {
    if(defragmented.type === undefined) {
        (new ErrorMessage(socket, "INVALID_FORMAT", "No type field found in json.")).send()
        return false
    } 
    let selected_class = selector[defragmented.type]
    if(selected_class == undefined) {
        (new ErrorMessage(socket, "INVALID_FORMAT", `Invalid message type ${defragmented.type}`)).send()
        return false
    }
    return true
}

server.on("connection", function(socket : Socket) {
    let marabu_socket = new MarabuSocket(socket)
    let json_defragmenter = new JSONDefragmenter(marabu_socket);
    let handshake_completed : Boolean = false;
    create_hello_message(marabu_socket, blockchain_state).run_send_actions()
    create_get_peers_message(marabu_socket, blockchain_state).run_send_actions()
    marabu_socket.socket.on('data', function(chunk : Buffer) {
        for(const defragmented of json_defragmenter.feed(chunk)) {
            if(!run_initial_checks(marabu_socket, defragmented)) {
                continue
            }
            // TODO: Indicate this is Message type
            let selected_class = selector[defragmented.type]
            let message : Message = new selected_class(marabu_socket, defragmented, blockchain_state)
            if(!handshake_completed) {
                if(defragmented.type != "hello") {
                    // Only want to terminate with invalid handshake if you get a different valid message before hello
                    // Run full verification, if it fails then we print format/whatever error and continue, otherwise invalid handshake and destroy socket.
                    if(message.run_receive_verify()) {
                        (new ErrorMessage(marabu_socket, "INVALID_HANDSHAKE", "Handshake not complete.")).send()
                        return
                    } else {
                        // Error already sent!
                        continue
                    }
                }
            }
            if(handshake_completed && defragmented.type === "hello") {
                // Very very hacky, TODO: change to have override instead (or better)
                handshake_completed = false;
                (new ErrorMessage(marabu_socket, "INVALID_HANDSHAKE", "Got a second hello message after handshake was already complete.")).send()
                return
            } 
            if(!handshake_completed && defragmented.type == "hello") {
                if(message.run_receive_verify()) {
                    handshake_completed = true
                }
                continue
            }
            message.run_receive_actions()
        }
    }
)})

for(const peer of blockchain_state.get_peers().slice(0, 10)) {
    let peers_split : Array<string> = peer.split(":")
    let host_ip : string = peers_split.slice(0, -1).join("")
    let port : number = parseInt(peers_split[peers_split.length-1])
    let client_socket : Socket = new Socket()
    let marabu_client_socket = new MarabuSocket(client_socket)
    let json_defragmenter = new JSONDefragmenter(marabu_client_socket);
    let handshake_completed : Boolean = false;
    marabu_client_socket.socket.connect({port : port, host : host_ip}, function() {
        create_hello_message(marabu_client_socket, blockchain_state).run_send_actions()
    })
    marabu_client_socket.socket.on("data", function(chunk) {
        for(const defragmented of json_defragmenter.feed(chunk)) {
            // Check basic format
            if(!run_initial_checks(marabu_client_socket, defragmented)) {
                continue
            }
            if(!handshake_completed) {
                if(defragmented.type != "hello") {
                    (new ErrorMessage(marabu_client_socket, "INVALID_HANDSHAKE", "Handshake not complete.")).send()
                    continue
                }
                let hello_message = new HelloMessage(marabu_client_socket, defragmented, blockchain_state)
                if(!hello_message.run_receive_verify()) {
                    continue
                }
                create_get_peers_message(marabu_client_socket, blockchain_state).run_send_actions()
                handshake_completed = true
            } else {
                // TODO: Same as above for message type
                let selected_class = selector[defragmented.type]
                let message : Message = new selected_class(marabu_client_socket, defragmented, blockchain_state)
                message.run_receive_actions()
            }
        }
    })
    marabu_client_socket.socket.on("error", ()=>{console.log(`Wasn't able to connect to a client at ${host_ip}:${port}.`)})
}