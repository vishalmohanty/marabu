import {Server, Socket, SocketAddress} from "net";
import {JSONDefragmenter} from "./util/json_defragmenter"
import {ErrorMessage} from "./protocol/messaging/messages/error"
import {selector} from "./protocol/messaging/selector"
import { Message } from "./protocol/messaging/message_types/message";
import { BlockchainState } from "./protocol/state/blockchain_state";
import { create_hello_message, HelloMessage } from "./protocol/messaging/messages/hello";
import { create_get_peers_message } from "./protocol/messaging/messages/getpeers";
import { MarabuSocket } from "./util/marabu_socket";
import { create_get_chaintip_message } from "./protocol/messaging/messages/getchaintip";
import { create_get_mempool_message } from "./protocol/messaging/messages/getmempool"
import {config} from "./config"
import { gossip } from "./util/gossip";
import { create_i_have_object_message } from "./protocol/messaging/messages/ihaveobject";
import { create_object_message } from "./protocol/messaging/messages/object";
import { get_from_db, put_in_db } from "./util/object_database";
import { MarabuObject } from "./protocol/messaging/messages/objects/object_type";
import { create_coinbase_transaction } from "./scripts/mine";
import { Block } from "./protocol/messaging/messages/objects/block";
import { get_from_height_db } from "./util/height_database";

const PROD_DIFFICULTY = "00000000abc00000000000000000000000000000000000000000000000000000"

let PORT : Number = 18018
let BACKING_FILE_NAME : string = "src/protocol/state/data.json"
let debug_cli = false
if(process.argv.length == 3) {
    if(process.argv[2] == "true") {
        debug_cli = true
    }
}
config.debug = debug_cli

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
    create_get_chaintip_message(marabu_socket, blockchain_state).run_send_actions()
    create_get_mempool_message(marabu_socket, blockchain_state).run_send_actions()
    marabu_socket.socket.on('data', function(chunk : Buffer) {
        for(const defragmented of json_defragmenter.feed(chunk)) {
            if(!run_initial_checks(marabu_socket, defragmented)) {
                continue
            }
            // TODO: Indicate this is Message type
            let selected_class = selector[defragmented.type]
            let message = new selected_class(marabu_socket, defragmented, blockchain_state)
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
                create_get_chaintip_message(marabu_client_socket, blockchain_state).run_send_actions()
                create_get_mempool_message(marabu_client_socket, blockchain_state).run_send_actions()
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

// Did this way for cleanliness
let self_client = new Socket()
self_client.connect({ port: 18018, host: "localhost" }, () => {
    self_client.write(JSON.stringify({"type": "hello",  "version": "0.9.0", "agent": "Self Client"}) + "\n")
})

function send_message_to_self(message) {
    self_client.write(message)
}

let golang_server = new Server()
const GOLANG_PORT = 19000
golang_server.listen(GOLANG_PORT, () => `Server also listening on port ${GOLANG_PORT}`)
golang_server.on("connection", function(socket : Socket) {
    blockchain_state.golang_sockets.add(socket)
    console.log("Received golang connection\n")
    // Copy pasted for now....
    let starting_nonce : string = (Math.random()*Math.pow(2, 256)).toString(16)
    console.log(`Starting nonce ${starting_nonce}`)
    starting_nonce = "0".repeat(64-starting_nonce.length) + starting_nonce
    let coinbase_txn = create_coinbase_transaction({height: blockchain_state.chain_length+1, outputs: [{pubkey: "e54f6be504b8707bdea7e2a95bb10d17f378c761cc4409b3fdcca38d23646ed5", value: 50000000000000}]})
    let coinbase_objectid = MarabuObject.get_object_id(coinbase_txn)
    put_in_db(coinbase_objectid, coinbase_txn).then(() => gossip(create_i_have_object_message, this.blockchain_state, coinbase_objectid))
    let new_block : Block = {
        type: "block",
        txids: [coinbase_objectid, "eaa145ad59622ab3e27e8ae3347232062f0284e7b47d0f7194ce7c8664069f0a"],
        nonce: starting_nonce,
        previd: blockchain_state.chaintip,
        created: Date.now() / 1000,
        T: PROD_DIFFICULTY,
        miner: "Definitely honest!",
        note: "Plz work",
        studentids: ["vmohanty", "sudeepn"]
    }
    socket.write(JSON.stringify(new_block))
    // Assume non-fragmented complete data
    socket.on("data", function(data : Buffer) {
        let block : Block = JSON.parse(data.toString("utf-8"))
        // This will lead to gossip
        console.log(`Sending object message to self`)
        send_message_to_self(JSON.stringify({"object": block, "type": "object"}) + "\n")
    })
})

golang_server.on("close", (socket : Socket) => {
    blockchain_state.golang_sockets.delete(socket)
})