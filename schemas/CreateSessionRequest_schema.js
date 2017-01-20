
const CreateSessionRequest_Schema = {
    documentation: "Creates a new session with the server.",
    name: "CreateSessionRequest",
    fields: [
        { name: "requestHeader"    ,                fieldType: "RequestHeader"                  },

        { name: "clientDescription",                fieldType: "ApplicationDescription",
            documentation:"Describes the client application." },

        // This value is only specified if the EndpointDescription has a gatewayServerUri. This value is the
        // applicationUri from the EndpointDescription which is the applicationUri for the underlying Server.
        { name: "serverUri",                        fieldType: "String",
            documentation:"The URI of the server that the client wants to create a session with." },

        // The network address that the Client used to access the Session Endpoint.The HostName portion of the URL
        // should be one of the HostNames for the application that are specified in the Server’s
        // ApplicationInstanceCertificate (see 7.2). The Server shall raise an AuditUrlMismatchEventType event if the
        // URL does not match the Server‟s HostNames. AuditUrlMismatchEventType event type is defined in Part 5. The
        // uses this information for diagnostics and to determine the set of EndpointDescriptions to return in
        // the response.
        { name: "endpointUrl",                      fieldType: "String",
            documentation:"The URL that the client used to connect to the server." },

        // Human readable string that identifies the Session. The Server makes this name and the sessionId visible in
        // its AddressSpace for diagnostic purposes. The Client should provide a name that is unique for the instance
        // of the Client.
        // If this parameter is not specified the Server shall assign a value.
        { name: "sessionName",                      fieldType: "String",
            documentation:"A name for the session provided by the client." },

        // A random number that should never be used in any other request. This number shall have a minimum length of 32
        // bytes. Profiles may increase the required length. The Server shall use this value to prove possession of
        // its application instance Certificate in the response.
        { name: "clientNonce",                      fieldType: "ByteString",
            documentation:"A random number generated by the client." },

        // The application instance Certificate issued to the Client. If the securityPolicyUri is None, the Client shall
        // not send an ApplicationInstanceCertificate and the Server shall ignore the ApplicationInstanceCertificate.
        { name: "clientCertificate",                fieldType: "ByteString",
            documentation:"The application certificate for the client." },

        // Duration Requested maximum number of milliseconds that a Session should remain open without activity.
        // If the Client fails to issue a Service request within this interval, then the Server shall automatically
        // terminate the Client Session.
        { name: "requestedSessionTimeout",          fieldType: "Duration",
            documentation:"The requested session timeout in milliseconds." },

        // The maximum size, in bytes, for the body of any response message.
        // The Server should return a Bad_ResponseTooLarge service fault if a response
        // message exceeds this limit.
        // The value zero indicates that this parameter is not used.
        { name: "maxResponseMessageSize",           fieldType: "UInt32",
            documentation:"The maximum message size accepted by the client." }
    ]
};
export {CreateSessionRequest_Schema};
