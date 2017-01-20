
const NotificationMessage_Schema = {
    name: "NotificationMessage",
    fields: [
        { name: "sequenceNumber", fieldType: "Counter" },
        { name: "publishTime", fieldType: "UtcTime"},
        { name: "notificationData", isArray: true, fieldType: "ExtensionObject"}
        // could be DataChangeNotification or EventNotificationList
    ]
};
export {NotificationMessage_Schema};

