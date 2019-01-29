import express from "express";
import { Server } from "http";
import SocketIO from "socket.io";

const app = express();
const http = new Server(app);
const io = SocketIO(http);

io.on('connection', function(socket){
  console.log('a user connected');
});

http.listen(3001, function(){
  console.log('listening on *:3001');
});