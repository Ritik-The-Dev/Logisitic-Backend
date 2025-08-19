import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { FIREBASE_PROJECT_ID } from '../config/constant';
import mongoose, { Date } from 'mongoose';

interface NotificationPayload {
    message: {
        token: string;
        // notification: any;
        data: any;
        android: any;
        apns: any;
    };
}

const serviceAccountPath: string = path.join(__dirname, "../config/firebase-keys.json");
const serviceAccount: admin.ServiceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

const url: string = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account key file not found:', serviceAccountPath);
    process.exit(1);
}

const firebase = admin.initializeApp({
    credential: admin.credential.cert(require('../config/firebase-keys.json'))
});

async function getAccessToken() {
    const token = await admin.credential.cert(serviceAccount).getAccessToken();
    return token.access_token;
}

const formatLocation = (location: string): string => {
    if (!location) return '';
    return location.length >= 25 ? `${location.substring(0, 25)}...` : location;
};

export async function sendTestNotification(fcmToken: string, trip: {
    _id: mongoose.Types.ObjectId
    trip_cost_customer: number;
    trip_cost_driver: number;
    type: string;
    from: string;
    to: string;
}) {

    // const payload: NotificationPayload = {
    //     message: {
    //         token: fcmToken,
    //         notification: {
    //             title: `New Trip Requested`,
    //             body: `Amount | ₹${trip.trip_cost_customer}`,
    //         },
    //         data: {
    //             trip_id: trip._id,
    //             cost_customer: trip.trip_cost_customer.toString(),
    //             cost_driver: trip.trip_cost_driver.toString(),
    //             source: trip.from,
    //             destination: trip.to,
    //         },
    //         android: {
    //             priority: "high",
    //             notification: {
    //                 click_action: "TRIP_DETAILS",
    //                 channel_id: "trip_notifications",
    //             },
    //             data: {
    //                 actions: JSON.stringify([
    //                     { title: "Accept", action: "ACCEPT_TRIP" },
    //                     { title: "Reject", action: "REJECT_TRIP" },
    //                 ]),
    //             },
    //         },
    //         apns: {
    //             headers: {
    //                 "apns-priority": "10",
    //             },
    //             payload: {
    //                 aps: {
    //                     category: "TRIP_ACTIONS",
    //                     sound: "default",
    //                     contentAvailable: 1,
    //                 },
    //             },
    //         },
    //     },
    // };

    // const accessToken = await getAccessToken();
    // const headers = {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${accessToken}`,
    // };

    const message = {
        token: fcmToken, // Target the user's device token
        // notification: {
        // title: `New Trip Requested`,
        // body: `Amount | ₹${trip.trip_cost_customer}`,
        // },
        data: {
            title: `New Trip Requested`,
            body: `Amount | ₹${trip.type == "customer" ? trip.trip_cost_customer : trip.trip_cost_driver} | ${formatLocation(trip.from)} -> ${formatLocation(trip.to)}`,
            trip_id: trip._id.toString(),
            cost_customer: trip.trip_cost_customer.toString(),
            cost_driver: trip.trip_cost_driver.toString(),
            source: trip.from,
            destination: trip.to,
            screen: "Profile",
            "jobId": trip._id.toString(),
            type: "request",
            "showButtons": "true"
        }
    };

    try {
        const data = await admin.messaging().send(message);
        console.log('Notification sent successfully:', data);
        // const response = await axios.post(url, payload, { headers });
        // if (response && response.data) {
        //     return {
        //         url,
        //         payload,
        //         token: maskToken(accessToken),
        //         responseDetail: response.data
        //     }
        // }
    } catch (error: any) {
        console.error('Failed to send notification:', error?.message);
        return error?.response || error?.message
    }
}

export async function sendTripNotification(fcmToken: string, trip: {
    _id: mongoose.Types.ObjectId;
    trip_cost_customer: number;
    trip_cost_driver: number;
    type: string;
    from: string;
    to: string;
    eta_pickup?: string;
}) {
    // const payload: NotificationPayload = {
    //     message: {
    //         token: fcmToken,
    //         notification: {
    //             title: `New Trip Requested`,
    //             body: `Amount | ₹${trip.trip_cost_customer}`,
    //         },
    //         data: {
    //             trip_id: trip._id,
    //             cost_customer: trip.trip_cost_customer.toString(),
    //             cost_driver: trip.trip_cost_driver.toString(),
    //             source: trip.from,
    //             destination: trip.to,
    //             eta_pickup: trip.eta_pickup ? trip.eta_pickup : ""
    //         },
    //         android: {
    //             priority: "high",
    //             notification: {
    //                 click_action: "TRIP_DETAILS",
    //                 channel_id: "trip_notifications",
    //             },
    //             data: {
    //                 actions: JSON.stringify([
    //                     {
    //                         title: "Accept",
    //                         action: "ACCEPT_TRIP",
    //                     },
    //                     {
    //                         title: "Reject",
    //                         action: "REJECT_TRIP",
    //                     }
    //                 ])
    //             }
    //         },
    //         apns: {
    //             headers: {
    //                 "apns-priority": "10",
    //             },
    //             payload: {
    //                 aps: {
    //                     category: "TRIP_ACTIONS",
    //                     sound: "default",
    //                     contentAvailable: 1,
    //                 }
    //             }
    //         }
    //     }
    // };

    const message = {
        token: fcmToken,
        // notification: {
        // title: `New Trip Requested`,
        // body: `Amount | ₹${trip.trip_cost_customer}`,
        // },
        data: {
            title: `New Trip Requested`,
            // body: `Amount | ₹${trip.trip_cost_customer}`,
            body: `Amount | ₹${trip.type == "customer" ? trip.trip_cost_customer : trip.trip_cost_driver} | ${formatLocation(trip.from)} -> ${formatLocation(trip.to)}`,
            trip_id: trip._id.toString(),
            cost_customer: trip.trip_cost_customer.toString(),
            cost_driver: trip.trip_cost_driver.toString(),
            source: trip.from,
            destination: trip.to,
            eta_pickup: trip.eta_pickup ? trip.eta_pickup : "",
            screen: "Profile",
            "jobId": trip._id.toString(),
            type: "request",
            "showButtons": "true"

        }
    };

    // const accessToken = await getAccessToken();
    // const headers = {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${accessToken}`,
    // };

    try {
        // const response = await axios.post(url, payload, { headers });
        // if (response && response.data) {
        //     return {
        //         url,
        //         payload,
        //         token: maskToken(accessToken),
        //         responseDetail: response.data
        //     }
        // }
        const data = await admin.messaging().send(message);
        console.log('Notification sent successfully:', data);
    } catch (error: any) {
        console.error('Failed to send notification:', error?.response?.data.error);
        return error?.response || error?.message
    }
}

export async function sendPassengerTripNotification(fcmToken: string, trip: {
    _id: mongoose.Types.ObjectId;
    type: string;
    response: string;
}) {

    // const payload: NotificationPayload = {
    //     message: {
    //         token: fcmToken,
    //         notification: {
    //             title: `'Driver Respond'`,
    //             body: `${trip.response} delivery`,
    //         },
    //         data: {
    //             trip_id: trip._id.toString(),
    //             type: 'trip_update'
    //         },
    //         android: {
    //             priority: "high"
    //         },
    //         apns: {
    //             headers: {
    //                 "apns-priority": "10",
    //             },
    //             payload: {
    //                 aps: {
    //                     contentAvailable: 1,
    //                 }
    //             }
    //         }
    //     }
    // };

    const message = {
        token: fcmToken,
        // notification: {
        // title: `'Driver Respond'`,
        // body: `${trip.response} delivery`,
        // },
        data: {
            title: `'Driver Respond'`,
            body: `${trip.response} delivery`,
            trip_id: trip._id.toString(),
            screen: "Profile",
            "jobId": trip._id.toString(),
            type: "trip_update",
            "showButtons": "false",

        }
    };

    // const accessToken = await getAccessToken();
    // const headers = {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${accessToken}`,
    // };

    try {
        // const response = await axios.post(url, payload, { headers });
        // if (response && response.data) {
        //     return {
        //         url,
        //         payload,
        //         token: maskToken(accessToken),
        //         responseDetail: response.data
        //     }
        // }
        const data = await admin.messaging().send(message);
        console.log('Notification sent successfully:', data);
    } catch (error: any) {
        console.error('Failed to send notification:', error?.response?.data.error);
        return error?.response || error?.message
    }
}

export async function sendRejectionTripNotification(fcmToken: string, trip: {
    _id: mongoose.Types.ObjectId;
    type: string;
    response: string;
}) {

    // const payload: NotificationPayload = {
    //     message: {
    //         token: fcmToken,
    //         notification: {
    //             title: `'Driver Respond'`,
    //             body: `${trip.response}`,
    //         },
    //         data: {
    //             trip_id: trip._id.toString(),
    //             type: 'trip_update'
    //         },
    //         android: {
    //             priority: "high"
    //         },
    //         apns: {
    //             headers: {
    //                 "apns-priority": "10",
    //             },
    //             payload: {
    //                 aps: {
    //                     category: "TRIP_ACTIONS",
    //                     sound: "default",
    //                     contentAvailable: 1,
    //                 }
    //             }
    //         }
    //     }
    // };

    const message = {
        token: fcmToken,
        // notification: {
        // title: `'Driver Respond'`,
        // body: `${trip.response} delivery`,
        // },
        data: {
            title: `'Driver Respond'`,
            body: `${trip.response} delivery`,
            trip_id: trip._id.toString(),
            screen: "Profile",
            "jobId": trip._id.toString(),
            type: "trip_update",
            "showButtons": "false"
        }
    };

    // const accessToken = await getAccessToken();
    // const headers = {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${accessToken}`,
    // };

    try {
        // const response = await axios.post(url, payload, { headers });
        // if (response && response.data) {
        //     return {
        //         url,
        //         payload,
        //         token: maskToken(accessToken),
        //         responseDetail: response.data
        //     }
        // }
        const data = await admin.messaging().send(message);
        console.log('Notification sent successfully:', data);
    } catch (error: any) {
        console.error('Failed to send notification:', error?.response?.data.error);
        return error?.response || error?.message
    }
}

export async function sendMessageNotification(fcmToken: string, title: string, msg: string) {

    // const payload: NotificationPayload = {
    //     message: {
    //         token: fcmToken,
    //         notification: {
    //             title: title,
    //             body: `${msg}`,
    //         },
    //         data: {},
    //         android: {
    //             priority: "high"
    //         },
    //         apns: {
    //             headers: {
    //                 "apns-priority": "10",
    //             }
    //         }
    //     }
    // };

    const message = {
        token: fcmToken,
        // notification: {
        // title: title,
        // body: `${msg}`,
        // },
        data: {
            title: title,
            body: `${msg}`,
            screen: "Profile",
            "jobId": "test",
            type: "request",
            "showButtons": "false"
        }
    };

    // const accessToken = await getAccessToken();
    // const headers = {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${accessToken}`,
    // };

    try {
        // const response = await axios.post(url, payload, { headers });
        // if (response && response.data) {
        //     return {
        //         url,
        //         payload,
        //         token: maskToken(accessToken),
        //         responseDetail: response.data
        //     }
        // }
        const data = await admin.messaging().send(message);
        console.log('Notification sent successfully:', data);
    } catch (error: any) {
        console.error('Failed to send notification:', error?.response?.data.error);
        return error?.response || error?.message
    }
}

export async function sendOverlayNotification(fcmToken: string, data_type: string, msg: string) {

    // const payload: NotificationPayload = {
    //     message: {
    //         token: fcmToken,
    //         notification: {},
    //         data: {
    //             type: data_type
    //         },
    //         android: {
    //             priority: "high"
    //         },
    //         apns: {}
    //     }
    // };

    const message = {
        token: fcmToken,
        // notification: {},
        data: {
            screen: "Profile",
            "jobId": "test",
            type: data_type,
            "showButtons": "true"
        }
    };

    // const accessToken = await getAccessToken();
    // const headers = {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${accessToken}`,
    // };

    try {
        // const response = await axios.post(url, payload, { headers });
        // if (response && response.data) {
        // return {
        //     url,
        //     payload,
        //     token: maskToken(accessToken),
        //     responseDetail: response.data
        // }
        // }
        const data = await admin.messaging().send(message);
        console.log('Notification sent successfully:', {
            url,
            message,
            // token: maskToken(accessToken),
            responseDetail: data
        });
    } catch (error: any) {
        console.error('Failed to send notification:', error?.response?.data.error);
        return error?.response || error?.message
    }
}