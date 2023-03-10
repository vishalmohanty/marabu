// While not strictly necessary, this makes it easier to verify coinbase
// heights

import level from 'level-ts';

const object_database = new level('./height-database');

async function exists_in_height_db(s : string) : Promise<Boolean> {
    return await object_database.exists(s)
}

async function put_in_height_db(s : string, val : any) {
    await await object_database.put(s, val)
}

async function get_from_height_db(s : string | null) : Promise<any> {
    return await object_database.get(s)
}

export {exists_in_height_db, put_in_height_db, get_from_height_db}