import {Socket} from "net";

// The port number and hostname of the server.
const PORT = 18018;
const hostIP = "149.28.223.2"

// Create a new TCP client.
const client = new Socket();
// Send a connection request to the server.
client.connect({ port: PORT, host: hostIP }, function() {
    // If there is no error, the server has accepted the request and created a new
    // socket dedicated to us.
    console.log('TCP connection established with the server with IP address ' + hostIP);

    // The client can now send data to the server by writing to its socket.
    client.write('{"type": "hello", "agent": "Marabu-Core Client 0.9", "version": "0.9.3"}');
    

    // setTimeout(() => {
    //         client.write('\n');
    // }, 5000);
});