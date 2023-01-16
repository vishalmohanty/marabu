// import lockfile from "proper-lockfile"
import * as fs from "fs"

// class NonvolatileState {
//     backing_file_name : string
//     name : string
//     constructor(backing_file_name : string, name : string) {
//         this.backing_file_name = backing_file_name
//         this.name = name
//     }
//     async set(val) {
//         await lockfile.lock(this.backing_file_name).then(
//             (release) =>{
//                 let obj = this._read_all()
//                 obj[this.name] = val
//                 this._write_all(obj)
//                 return release()
//             }
//         )
//     }
    
//     _read_all() : Object {
//         let existing_obj_string : string = fs.readFileSync(this.backing_file_name, 'utf-8')
//         return JSON.parse(existing_obj_string)
//     }
//     _write_all(obj : Object) {
//         fs.writeFileSync(this.backing_file_name, JSON.stringify(obj))
//     }
// }

class NonvolatileState<T> {
    backing_file_name : string
    name : string
    constructor(backing_file_name : string, name : string) {
        this.backing_file_name = backing_file_name
        this.name = name
    }
    set(val : T) {
        let obj = this._read_all()
        obj[this.name] = val
        this._write_all(obj)
    }

    read() : T {
        let obj = this._read_all()
        return obj[this.name]
    }

    _read_all() : Object {
        let existing_obj_string : string = fs.readFileSync(this.backing_file_name, 'utf-8')
        return JSON.parse(existing_obj_string)
    }
    _write_all(obj : Object) {
        fs.writeFileSync(this.backing_file_name, JSON.stringify(obj))
    }
}


export {NonvolatileState}