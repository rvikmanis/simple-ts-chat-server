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

interface JoinLine {
  type: "join";
  time: number;
  user: string;
}

interface QuitLine {
  type: "quit";
  time: number;
  user: string;
}

interface MessageLine {
  type: "message";
  time: number;
  from: string;
  text: string;
}

type Line =
  | JoinLine
  | QuitLine
  | MessageLine

function formatLine(line: Line) {
  const time = new Date(line.time).toLocaleString();
  
  if (line.type === "join") {
    return `[${time}] ${line.user} joined`
  }

  if (line.type === "quit") {
    return `[${time}] ${line.user} quit`
  }

  if (line.type === "message") {
    return `[${time}] <${line.from}>: ${line.text}`
  }
}

function log(line: Line) {
  console.log(formatLine(line));
}

io.on('connection', (socket: Socket) => {
  
  socket.on('setNick', (nick: string) => {    
    if (!nicksToSockets.has(nick)) {
      nicksToSockets.set(nick, socket);
      socket.nick = nick;
      socket.emit('nickOk');
      const line = {
        type: "join",
        time: new Date().valueOf(),
        user: nick
      } as JoinLine;
      socket.broadcast.emit('line', line);
      log(line);
      updateInactivityTimer(nick);
    } else {
      socket.emit('nickTaken');
    }

  });

  socket.on('message', (text: string) => {
    if (socket.nick) {
      updateInactivityTimer(socket.nick);
      const line = {
        type: "message",
        time: new Date().valueOf(),
        from: socket.nick,
        text: text
      } as MessageLine;
      socket.broadcast.emit('line', line);
      log(line);
    }
  });

  socket.on('disconnect', () => {
    if (socket.nick) {
      nicksToSockets.delete(socket.nick);
      const line = {
        type: "quit",
        time: new Date().valueOf(),
        user: socket.nick
      } as QuitLine;
      socket.broadcast.emit('line', line);
      log(line);
    }
  });

});

http.listen(3001, function(){
  console.log(`[${new Date().toLocaleString()}] Listening on *:3001`);
});

function killHandler() {
  io.emit('serverShutdown');
  console.log(`[${new Date().toLocaleString()}] Server shut down`)
  http.close();
  process.exit();
}

process.on('SIGINT', killHandler);
process.on('SIGTERM', killHandler);