import React, {useContext} from 'react';
import {SocketContext} from "../SocketProvider";

const useSocket = () => {
    const socket = useContext(SocketContext);
    return socket;
}

export default useSocket;