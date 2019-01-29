import express from "express";
import { Server } from "http";
import SocketIO from "socket.io";

const app = express();
const http = new Server(app);
const io = SocketIO(http);

const nicksToSockets = new Map();

io.on('connection', (socket: SocketIO.Socket & { nick?: string }) => {
  console.log('a user connected');
  
  socket.on('setNick', (nick: string) => {
    console.log(`received nick: ${nick}`);
    
    if (!nicksToSockets.has(nick)) {
      nicksToSockets.set(nick, socket);
      socket.nick = nick;
      socket.emit('nickOk');
      socket.broadcast.emit('line', {
        type: "join",
        time: new Date().valueOf(),
        user: nick
      });
    } else {
      socket.emit('nickTaken');
    }

  });

  socket.on('disconnect', () => {
    if (socket.nick) {
      console.log(`user (${socket.nick}) disconnected`);
      nicksToSockets.delete(socket.nick);
      socket.broadcast.emit('line', {
        type: "quit",
        time: new Date().valueOf(),
        user: socket.nick
      });
    } else {
      console.log('a user disconnected');
    }
  })
});

http.listen(3001, function(){
  console.log('listening on *:3001');
});