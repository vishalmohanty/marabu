import level from 'level-ts';

const object_database = new level('./object-database');

async function exists_in_db(s : string) : Promise<Boolean> {
    return await object_database.exists(s)
}

async function put_in_db(s : string, val : any) {
    await await object_database.put(s, val)
}

async function get_from_db(s : string) : Promise<any> {
    return await object_database.get(s)
}

export {exists_in_db, put_in_db, get_from_db}