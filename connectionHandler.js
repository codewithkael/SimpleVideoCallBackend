const usersList = {}                 // username -> websocket
const userTokens = {}               // *** MODIFIED *** username -> FCM token

const serviceAccount = require('./call-notificaton-firebase-adminsdk-fbsvc-2724d2f154.json')
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

class ConnectionHandler {
    static handleConnection(token, username, socket) {

        // *** MODIFIED ***
        // Save this user’s device FCM token
        userTokens[username] = token

        // Store the websocket reference
        usersList[username] = socket

        socket.on('close', () => {
            delete usersList[username]
            // delete userTokens[username]  // *** MODIFIED ***
            console.log(`${username} disconnected`)
        })

        socket.on('message', (message) => {
            let normalizedMessage = JSON.parse(message)

            console.log("Received:", normalizedMessage.type)

            switch (normalizedMessage.type) {

                case SignalTypes().findUser:
                    findUser(normalizedMessage, socket)
                    break

                case SignalTypes().sendCallNotification:
                    // *** MODIFIED ***
                    sendCallNotification(normalizedMessage)
                    break

                default:
                    forwardMessage(normalizedMessage, socket)
                    break
            }
        })
    }
}

// ----------------------
// SEND FCM NOTIFICATION
// ----------------------

/**
 * message = {
 *   type: "SendCallNotification",
 *   from: "Alice",
 *   target: "Bob",
 *   callId: "12345"
 * }
 */
const sendCallNotification = async (message) => {

    const targetUser = message.target

    console.log("Sending FCM Call Notification to:", message)

    // *** MODIFIED ***
    // Check if target user token exists
    if (!userTokens[targetUser]) {
        console.log("Target has no FCM token:", targetUser)
        return
    }

    const targetToken = userTokens[targetUser]

    // Build FCM payload
    const payload = {
        token: targetToken,
        data: message,
        android: {
            priority: "high"
        }
    }

    try {
        const result = await admin.messaging().send(payload)
        console.log("FCM sent:", result)
    } catch (err) {
        console.error("FCM ERROR:", err)
    }
}

// ----------------------
// FORWARD MESSAGE LOGIC
// ----------------------
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
    if (userToFind && usersList[userToFind]) {
        const successMessage = message
        successMessage.type = SignalTypes().userOnline
        sendMessageToClient(successMessage, socket)
    } else {
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
        sendCallNotification: "SendCallNotification",
    }
}

module.exports = ConnectionHandler
