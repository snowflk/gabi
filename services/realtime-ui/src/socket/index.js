import socketio from "socket.io-client";
import logMessage from "../services/systemMessage";

export const initSocket = (server) => {
    const socket = socketio(server);
    socket.on("connect", () => {
        logMessage("Connected to server");
    });

    socket.on("disconnect", () => {
        logMessage("Disconnected to server");
    });

    socket.on("connect_error", () => {
        logMessage("Failed to connect to server");
    });

    return socket
};