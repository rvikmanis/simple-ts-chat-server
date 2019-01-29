import express from "express";
import { Server } from "http";
import SocketIO from "socket.io";
import { CLIENT_INACTIVITY_TIMEOUT } from "./config";

const clientInactivityTimeout = CLIENT_INACTIVITY_TIMEOUT * 1000;

const app = express();
const http = new Server(app);
const io = SocketIO(http);

type Socket = SocketIO.Socket & { nick?: string };

const nicksToSockets = new Map<string, Socket>();
const clientInactivityTimers = new Map<string, NodeJS.Timeout>();

function updateInactivityTimer(nick: string) {
  const previousTimer = clientInactivityTimers.get(nick);
  if (previousTimer) {
    clearTimeout(previousTimer);
  }

  const timer = setTimeout(() => {
    clientInactivityTimers.delete(nick);
    const socket = nicksToSockets.get(nick);
    if (socket) {
      socket.disconnect(true);
    }
  }, clientInactivityTimeout);

  clientInactivityTimers.set(nick, timer);
}

io.on('connection', (socket: Socket) => {
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
      updateInactivityTimer(nick);
    } else {
      socket.emit('nickTaken');
    }

  });

  socket.on('message', (text: string) => {
    if (socket.nick) {
      updateInactivityTimer(socket.nick);
      socket.broadcast.emit('line', {
        type: "message",
        time: new Date().valueOf(),
        from: socket.nick,
        text: text
      });
      console.log(`received message from ${socket.nick}: ${text}`);
    } else {
      console.log(`received message from unauthorized socket: ${text}`);
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