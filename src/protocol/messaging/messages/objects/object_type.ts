import {canonicalize} from "json-canonicalize"
import {createHash} from "blake2"
import {exists_in_db, put_in_db, get_from_db} from "../../../../util/object_database"
import { MarabuSocket } from "../../../../util/marabu_socket"
import { BlockchainState } from "../../../state/blockchain_state"
import { create_coinbase_transaction } from "../../../../scripts/mine"


abstract class MarabuObject {
    obj : any
    socket : MarabuSocket
    blockchain_state : BlockchainState

    constructor(socket : MarabuSocket, obj : any, blockchain_state : BlockchainState) {
        this.socket = socket
        this.obj = obj
        this.blockchain_state = blockchain_state
    }

    abstract _verify() : Promise<Boolean>;

    async post_receive_actions() {
        
    }

    static get_object_id(obj : any) : string {
        let raw_object_string : string = canonicalize(obj)
        let h = createHash("blake2s")
        h.update(Buffer.from(raw_object_string))
        let digest : string = h.digest("hex")
        return digest
    }
    
    async add_object() : Promise<Boolean> {
        let digest = MarabuObject.get_object_id(this.obj)
        let already_stored = await exists_in_db(digest)
        if(already_stored) {
            return false
        }
        await put_in_db(digest, this.obj)
        return true
    }

    // placeholder, need to override
    static isThisObject(obj : any) {
        return false
    }

    async complete_prereqs() : Promise<Boolean> {
        return true
    }

    // Returns true if you should gossip ihaveobject
    async run_receive() : Promise<Boolean> {
        if(await exists_in_db(MarabuObject.get_object_id(this.obj))) {
            // Already dealt with, no need to process again
            await this.post_receive_actions()
            return false
        }
        if(!await this._verify()) {
            return false
        }

        let added_to_db = await this.add_object()
        // Assumes object in db
        await this.post_receive_actions()
        if(!added_to_db) {
            return false
        }
        return true
    }
}

export {MarabuObject}