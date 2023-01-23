import {Message} from "../protocol/messaging/message_types/message"
import { MarabuSocket } from "./marabu_socket"

var active_peers : Set<MarabuSocket> = new Set()

function gossip(msg_creator, ...args) {
    active_peers.forEach((socket) => msg_creator(socket, ...args).run_send_actions())
}

export {gossip, active_peers}