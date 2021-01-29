import React from "react";


export const SocketContext = React.createContext(null);


export const SocketProvider = ({socket, children}) => {
    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    )
};
