import {canonicalize} from "json-canonicalize"
import {createHash} from "blake2"
import {exists_in_db, put_in_db, get_from_db} from "../../../../util/database"
import { MarabuSocket } from "../../../../util/marabu_socket"


abstract class MarabuObject {
    obj : any
    socket : MarabuSocket
    constructor(socket : MarabuSocket, obj : any) {
        this.socket = socket
        this.obj = obj
    }
    abstract _verify() : Promise<Boolean>;
    get_object_id() : string {
        let raw_object_string : string = canonicalize(this.obj)
        console.log(raw_object_string)
        let h = createHash("blake2s")
        h.update(Buffer.from(raw_object_string))
        let digest : string = h.digest("hex")
        return digest
    }
    async add_object() : Promise<Boolean> {
        let digest = this.get_object_id()
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

    // Returns true if you should gossip ihaveobject
    async run_receive() : Promise<Boolean> {
        if(!await this._verify()) {
            return false
        }
        if(!await this.add_object()) {
            return false
        }
        return true
    }
}

export {MarabuObject}