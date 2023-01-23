import * as ed25519 from "noble-ed25519";
import {canonicalize} from "json-canonicalize";
import {createHash} from "blake2";

async function func() {
    let private_key = ed25519.utils.randomPrivateKey()
    let public_key = await ed25519.getPublicKey(private_key)
    let obj = {"height":0,"outputs":[{"pubkey":Buffer.from(public_key).toString("hex"), "value":50000000000}],"type":"transaction"}
    console.log(JSON.stringify({"object": obj, "type": "object"}))
    let canonical_string = canonicalize(obj)
    let h = createHash("blake2s")
    h.update(Buffer.from(canonical_string))
    let txid : string = h.digest("hex")
    let obj2 = {"inputs":[{"outpoint":{"index":0, "txid":txid}, "sig":null}], "outputs":[{"pubkey":Buffer.from(public_key).toString("hex"), "value":10}],"type":"transaction"}
    let canonical_string2 = canonicalize(obj2)
    let signature = await ed25519.sign(canonical_string2, private_key)
    obj2["inputs"][0]["sig"] = signature
    console.log(JSON.stringify({"object": obj2, "type": "object"}))
}

func()

