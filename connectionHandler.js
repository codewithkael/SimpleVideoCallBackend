const usersList = {}

class ConnectionHandler {
    static handleConnection(username, socket) {
            usersList[username] = socket
            socket.on('close', () => {
                // Remove client from the clients map on disconnection
                delete usersList[username]
                console.log(`${username} disconnected`)
            })
            // Set up WebSocket event listeners
            socket.on('message', (message) => {
                let normalizedMessage = JSON.parse(message)
                // let normalizedMessage = message
                console.log(normalizedMessage.type)
                switch (normalizedMessage.type) {
                    case SignalTypes().findUser:
                        console.log("find user case")
                        findUser(normalizedMessage, socket)
                        break
                    default :
                        forwardMessage(normalizedMessage, socket)
                        break
                }
            })
    }
}

const forwardMessage = (message, socket) => {
    let userToFind = message.target
    if (userToFind && usersList[userToFind]) {
        let socketToSend = usersList[userToFind]
        sendMessageToClient(message, socketToSend)
    } else {
        const failureMessage = message
        failureMessage.type = SignalTypes().userOffline
        sendMessageToClient(failureMessage, socket)
    }
}

const findUser = (message, socket) => {
    let userToFind = message.target
    // Check if the user exists in the usersList
    if (userToFind && usersList[userToFind]) {
        // User found, send success message
        const successMessage = message
        successMessage.type = SignalTypes().userOnline
        sendMessageToClient(successMessage, socket)
    } else {
        // User not found, send failure message
        const failureMessage = message
        failureMessage.type = SignalTypes().userOffline
        sendMessageToClient(failureMessage, socket)
    }
}
const sendMessageToClient = (message, socket) => {
    socket.send(JSON.stringify(message))
}
const SignalTypes = () => {
    return {
        findUser: "FindUser",
        userOnline: "UserOnline",
        userOffline: "UserOffline",
    }
}

module.exports = ConnectionHandler
