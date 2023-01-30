import level from 'level-ts';

const object_database = new level('./utxo-database');

async function exists_in_utxo_db(s : string) : Promise<Boolean> {
    return await object_database.exists(s)
}

async function put_in_utxo_db(s : string, val : any) {
    await object_database.put(s, val)
}

async function get_from_utxo_db(s : string | null) : Promise<any> {
    // Empty pre-genesis
    if(s == null) {
        return []
    }
    return await object_database.get(s)
}

export {exists_in_utxo_db, put_in_utxo_db, get_from_utxo_db}