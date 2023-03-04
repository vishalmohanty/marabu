package main

import (
	"encoding/hex"

	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/blake2s"
)

type Block struct {
	// https://stackoverflow.com/questions/26327391/json-marshalstruct-returns
	// Exporting these fields by capitalizing first letter
	// `json....` are struct tags
	T string `json:"T"`
	// TODO: Change this to int once TAs fix
	Created    float32    `json:"created"`
	Miner      string     `json:"miner"`
	Nonce      string     `json:"nonce"`
	Note       string     `json:"note"`
	Previd     string     `json:"previd"`
	Studentids [](string) `json:"studentids"`
	Txids      [](string) `json:"txids"`
	Type       string     `json:"type"`
}

var hash, _ = blake2s.New256(nil)
var connection, err = net.Dial("tcp", "localhost:19000")
var target_block Block
var new_block = make(chan Block)
var leading_nonce = ""

func mine() {
	var iter int64 = 0
	for {
		select {
		case block := <-new_block:
			target_block = block
			leading_nonce = target_block.Nonce[:64-15]
			iter = 0
		default:
			json_block, err := json.Marshal(target_block)
			if err != nil {
				panic(err)
			}
			hash.Write(json_block)
			var res []byte
			res = hash.Sum(res)
			hash.Reset()
			str_res := hex.EncodeToString(res)
			str_res = strings.Repeat("0", 64-len(str_res)) + str_res
			if str_res < "00000000abc00000000000000000000000000000000000000000000000000000" {
				output, _ := json.Marshal(target_block)
				connection.Write(output)
			}
			iter_string := strconv.FormatInt(iter, 16)
			target_block.Nonce = leading_nonce + strings.Repeat("0", 15-len(iter_string)) + iter_string
			iter += 1
			if iter%100000 == 0 {
				fmt.Printf("Iteration: %d Nonce: %s\n", iter, target_block.Nonce)
			}
		}
	}
}

func listen_and_update() {
	buf := make([]byte, 4096)
	for {
		messageLen, err := connection.Read(buf)
		if err != nil {
			panic(err)
		}
		var new_block_from_js Block
		err = json.Unmarshal(buf[:messageLen], &new_block_from_js)
		if err != nil {
			panic(err)
		}
		fmt.Printf("Received new block %v\n", new_block_from_js.Nonce)
		// Indicate to mine routine that we got a new block
		// (this is a way to ensure the nonce received from node is the one used as a starting point for mining)
		new_block <- new_block_from_js
	}
}

func main() {
	if err != nil {
		panic(err)
	}
	go listen_and_update()
	go mine()
	time.Sleep(50 * time.Hour)
}
