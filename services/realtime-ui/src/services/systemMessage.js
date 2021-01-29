import eventBus from "./eventBus";

export default function logMessage(message) {
    eventBus.dispatch("system_msg", {
        timestamp: new Date().getTime(),
        message
    });
}