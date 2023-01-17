import {Socket} from "net";
import {canonicalize} from "json-canonicalize"
import {ErrorMessage} from "../messages/error"
import {BlockchainState} from "../../state/blockchain_state"

abstract class Message {
    required_keys : Array<string>
    socket : Socket
    obj : any
    abstract type : string
    blockchain_state : BlockchainState

    constructor(socket : Socket, obj : any, blockchain_state : BlockchainState) {
        this.socket = socket
        this.obj = obj
        this.blockchain_state = blockchain_state
    }

    /**
     * Method to test existence of all desired keys in JS object
     * @param obj: The JS object whose keys need to be verified
     * @returns true if all required_keys are present and false otherwise
     */
    _all_keys_exist(obj) : Boolean {
        return this.required_keys.every((key) => obj[key] != undefined)
    }

    /**
     * Method to send serialized version of self over socket
     */
    _send() {
        // Need newline to trigger delimetter on server side
        this.socket.write(canonicalize(this.obj)+"\n")
    }

    /**
     * Method which serially runs all actions needed in order
     * to send message over socket
     */
    run_send_actions() {
        var remoteAddress = this.socket.remoteAddress;
        console.log(`[message] Sending ${this.constructor.name} message to ${remoteAddress}`)
        this._send()
    }
    run_receive_verify() : Boolean {
        if(!this._all_keys_exist(this.obj)) {
            // Send error message (INVALID_FORMAT)
            (new ErrorMessage(this.socket, "INVALID_FORMAT", `Keys missing for message type ${this.type}`)).send()
            return false
        }
        if(!this._verify_message()) {
            return false
        }
        return true
    }

    run_receive_actions() {
        var remoteAddress = this.socket.remoteAddress;
        console.log(`[message] Received ${this.constructor.name} message from ${remoteAddress}`)
        if(!this.run_receive_verify()) {
            return
        }
        this._perform_validated_receive()
    }

    /**
     * Method in order to validate data passed in, method is
     * responsible for sending error message over socket
     */
    abstract _verify_message() : Boolean
    
    /**
     * Assume message has been completely validated and perform
     * necessary actions assuming you received this message
     */
    abstract _perform_validated_receive()
}

export {Message}