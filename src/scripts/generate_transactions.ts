import * as ed25519 from "@noble/ed25519";
import {canonicalize} from "json-canonicalize";
import {createHash} from "blake2";

async function func() {
    let private_key = ed25519.utils.randomPrivateKey()
    let public_key = await ed25519.getPublicKey(private_key)
    let coinbase_obj = {"height":0,"outputs":[{"pubkey":Buffer.from(public_key).toString("hex"), "value":50000000000}],"type":"transaction"}
    console.log(JSON.stringify({"object": coinbase_obj, "type": "object"}))
    let canonical_string = canonicalize(coinbase_obj)
    let h = createHash("blake2s")
    h.update(Buffer.from(canonical_string))
    let txid : string = h.digest("hex")
    let transaction_obj = {"inputs":[{"outpoint":{"index":0, "txid":txid}, "sig":null}], "outputs":[{"pubkey":Buffer.from(public_key).toString("hex"), "value":10}],"type":"transaction"}
    canonical_string = canonicalize(transaction_obj)
    // let signature = await ed25519.sign(Uint8Array.from(Buffer.from(canonical_string, 'utf-8')), private_key)
    let signature = await ed25519.sign(canonical_string, private_key)
    transaction_obj["inputs"][0]["sig"] = Buffer.from(signature).toString("hex")
    console.log(JSON.stringify({"object": transaction_obj, "type": "object"}))
}

func()