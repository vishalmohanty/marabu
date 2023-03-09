package main

import (
	"encoding/hex"
	"fmt"
	"net"
	"runtime"
	"time"

	"encoding/json"
	"strconv"
	"strings"

	"golang.org/x/crypto/blake2s"
)

type Block struct {
	// https://stackoverflow.com/questions/26327391/json-marshalstruct-returns
	// Exporting these fields by capitalizing first letter
	// `json....` are struct tags
	T          string     `json:"T"`
	Created    int64      `json:"created"`
	Miner      string     `json:"miner"`
	Nonce      string     `json:"nonce"`
	Note       string     `json:"note"`
	Previd     string     `json:"previd"`
	Studentids [](string) `json:"studentids"`
	Txids      [](string) `json:"txids"`
	Type       string     `json:"type"`
}

func mine(connection net.Conn, target_block Block, iter int64) bool {
	var hash, _ = blake2s.New256(nil)
	json_block, _ := json.Marshal(target_block)
	prev := json_block[:167]
	post := json_block[167+15:]
	for {
		iter += 1
		iter_string := strconv.FormatInt(iter, 16)
		n := append(append(prev[:], []byte(strings.Repeat("0", 15-len(iter_string)) + iter_string)[:]...), post...)
		hash.Write(n)
		var res []byte
		res = hash.Sum(res)
		hash.Reset()
		str_res := hex.EncodeToString(res)
		str_res = strings.Repeat("0", 64-len(str_res)) + str_res
		if str_res < "00000000abc00000000000000000000000000000000000000000000000000000" {
			connection.Write(n)
			return true
		}
		if iter%10000000 == 0 {
			fmt.Printf("%d\n", iter)
			return false
		}
	}
}

func listen_and_update() {
	var connection, err = net.Dial("tcp", "149.28.223.2:19000")
	if err != nil {
		panic(err)
	}
	var iter int64 = 0
	var new_block_from_js Block
	for {
		buf := make([]byte, 4096)
		connection.SetReadDeadline(time.Now().Add(time.Millisecond * 100))
		messageLen, _ := connection.Read(buf)
		if messageLen != 0 {
			fmt.Printf("%d %s\n", messageLen, buf[:messageLen])
			all_jsons := strings.Split(string(buf[:messageLen]), "\n")
			// In case of multiple JSONs, pick the latest one
			err = json.Unmarshal([]byte(all_jsons[len(all_jsons)-1]), &new_block_from_js)
			if err != nil {
				panic(err)
			}
			iter = 0
			fmt.Printf("Received new block %v\n", new_block_from_js.Nonce)
		}
		// Indicate to mine routine that we got a new block
		// (this is a way to ensure the nonce received from node is the one used as a starting point for mining)
		mine(connection, new_block_from_js, iter)
		iter += 10000000
	}
}

func main() {
	for i := 0; i < runtime.NumCPU(); i++ {
		go listen_and_update()
	}
	time.Sleep(50 * time.Hour)
}
