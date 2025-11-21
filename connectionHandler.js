const usersList = {}                 // username -> websocket
const userTokens = {}               // *** MODIFIED *** username -> FCM token

const serviceAccount = require('./call-notificaton-firebase-adminsdk-fbsvc-822eb0a964.json')
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

class ConnectionHandler {
    static handleConnection(token, username, socket) {
        // Save the user’s FCM token
        userTokens[username] = token;

        // Store the websocket reference
        usersList[username] = socket;

        socket.on('close', () => {
            delete usersList[username];
            // Optional: If you want to delete the token on disconnect
            // delete userTokens[username];
            console.log(`${username} disconnected`);
        });

        socket.on('message', async (message) => {
            let normalizedMessage = JSON.parse(message);
            console.log("Received:", normalizedMessage.type);

            switch (normalizedMessage.type) {
                case SignalTypes().findUser:
                    await handleFindUser(normalizedMessage, socket);
                    break;

                default:
                    forwardMessage(normalizedMessage, socket);
                    break;
            }
        });
    }}

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


const handleFindUser = async (message, socket) => {
    const targetUser = message.target;

    if (usersList[targetUser]) {  // Check if the user is online
        // If the user is online, send a "userOnline" response
        const successMessage = { ...message, type: SignalTypes().userOnline };
        sendMessageToClient(successMessage, socket);
    } else {  // User is offline
        console.log(`User ${targetUser} is offline, attempting to send call notification...`);

        // Try sending the call notification to their FCM token
        if (!userTokens[targetUser]) {
            console.log("Target user has no FCM token:", targetUser);
            // If no FCM token is available, just send a "userOffline" response
            const failureMessage = { ...message, type: SignalTypes().userOffline };
            sendMessageToClient(failureMessage, socket);
            return;
        }

        const targetToken = userTokens[targetUser];
        const payload = {
            token: targetToken,
            data: message,
            android: {
                priority: "high"
            }
        };

        try {
            const result = await admin.messaging().send(payload);  // Send FCM message
            console.log("FCM sent:", result);

            // If FCM was successful, treat as if the user is online and send a "userOnline" response
            const successMessage = { ...message, type: SignalTypes().userOfflineWithNotification };
            sendMessageToClient(successMessage, socket);
        } catch (err) {
            console.error("FCM ERROR:", err);

            // If FCM fails, send the "userOffline" response
            const failureMessage = { ...message, type: SignalTypes().userOffline };
            sendMessageToClient(failureMessage, socket);
        }
    }
};

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
const sendMessageToClient = (message, socket) => {
    socket.send(JSON.stringify(message))
}

const SignalTypes = () => {
    return {
        findUser: "FindUser",
        userOnline: "UserOnline",
        userOffline: "UserOffline",
        userOfflineWithNotification: "UserOfflineWithNotification",
    }
}

module.exports = ConnectionHandler
