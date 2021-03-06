const async = require("async");
const chalk = require("chalk");
const path = require("path");
const {
    start_simple_server,
    stop_simple_server
} = require("../../test_helpers/external_server_fixture");

const doDebug = false;
const debugLog = require("node-opcua-debug").make_debugLog("TEST");
let server_data = null;
const port = 2016;

function start_external_opcua_server(callback) {

    const options = {
        silent: !doDebug,
        server_sourcefile: path.join(__dirname, "../../test_helpers/bin/simple_server_with_custom_extension_objects.js"),
        port
    };

    start_simple_server(options, function(err, data) {
        if (err) {
            console.log("Cannot start simple server", options);
            return callback(err);
        }
        debugLog("data", data.endpointUrl);
        debugLog("certificate", data.serverCertificate.toString("base64").substring(0, 32) + "...");
        debugLog("pid", data.pid_collected);

        server_data = data;
        callback(err);
    });

}

function crash_external_opcua_server(callback) {

    if (!server_data) {
        return callback();
    }
    server_data.process.once("exit", function(err) {
        debugLog("process killed");
        callback();
    });
    server_data.process.kill("SIGTERM");
    server_data = null;

}

const opcua = require("node-opcua");
// ---------------------------------------------------------------------------------------------------------------------
let client, the_session, the_subscription, intervalId, monitoredItem;

function start_active_client(connectionStrategy, callback) {

    const endpointUrl = server_data.endpointUrl;

    client = opcua.OPCUAClient.create({
        connectionStrategy,
        endpointMustExist: false,
        keepSessionAlive: true,
        requestedSessionTimeout: 60000
    });

    const nodeId = opcua.coerceNodeId("ns=1;s=MyCounter");

    async.series([

        function client_connect(callback) {
            client.connect(endpointUrl, function(err) {
                if (err) {
                    debugLog(" cannot connect to endpoint :", endpointUrl);
                } else {
                    debugLog("connected !");
                }
                callback(err);
            });
            client.on("connection_reestablished", function() {
                debugLog(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
            });
            client.on("backoff", function(number, delay) {
                debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
            });
        },

        function client_recreate_session(callback) {
            client.createSession((err, session) => {
                if (err) {
                    console.log("endpointUrl = ", endpointUrl);
                    console.log("err = ", err);
                    return callback(err);
                }
                the_session = session;
                debugLog("session timeout = ", session.timeout);
                the_session.on("keepalive", function(state) {
                    if (doDebug) {
                        debugLog(chalk.yellow("KeepAlive state="),
                            state.toString(), " pending request on server = ",
                            the_subscription.publish_engine.nbPendingPublishRequests);
                    }
                });
                the_session.on("session_closed", function(statusCode) {
                    debugLog(chalk.yellow("Session has closed : statusCode = "), statusCode ? statusCode.toString() : "????");
                });
                callback();
            });
        },

        function client_create_subscription(callback) {
            // create a subscription
            const parameters = {
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 12,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 10
            };

            the_subscription = opcua.ClientSubscription.create(the_session, parameters);

            the_subscription.on("started", function() {

                if (doDebug) {

                    debugLog("started subscription :", the_subscription.subscriptionId);

                    debugLog(" revised parameters ");
                    debugLog("  revised maxKeepAliveCount  ", the_subscription.maxKeepAliveCount, " ( requested ", parameters.requestedMaxKeepAliveCount + ")");
                    debugLog("  revised lifetimeCount      ", the_subscription.lifetimeCount, " ( requested ", parameters.requestedLifetimeCount + ")");
                    debugLog("  revised publishingInterval ", the_subscription.publishingInterval, " ( requested ", parameters.requestedPublishingInterval + ")");
                    debugLog("  suggested timeout hint     ", the_subscription.publish_engine.timeoutHint);

                }
                callback();

            }).on("internal_error", function(err) {
                debugLog(" received internal error", err.message);

            }).on("keepalive", function() {

                debugLog(chalk.cyan("keepalive "), chalk.cyan(" pending request on server = "), the_subscription.publish_engine.nbPendingPublishRequests);

            }).on("terminated", function(err) {
                debugLog("Session Terminated", err.message);
            });

        },

        function client_create_monitoredItem(callback) {

            const result = [];
            const requestedParameters = {
                samplingInterval: 250,
                queueSize: 1,
                discardOldest: true
            };
            const item = { nodeId: nodeId, attributeId: opcua.AttributeIds.Value };

            monitoredItem = opcua.ClientMonitoredItem.create(the_subscription, item, requestedParameters, opcua.TimestampsToReturn.Both);
            monitoredItem.on("err", function(errMessage) {
                callback(new Error(errMessage));
            });
            monitoredItem.on("changed", function(dataValue) {
                if (doDebug) {
                    debugLog(chalk.cyan(" ||||||||||| VALUE CHANGED !!!!"), dataValue.statusCode.toString(), dataValue.value.toString());
                }
                result.push(dataValue);
            });
            monitoredItem.on("initialized", function() {
                if (doDebug) {
                    debugLog(" MonitoredItem initialized");
                }
                callback();
            });

        },
        function client_install_regular_activity(callback) {

            let counter = 0;

            function writeValue() {
                if (!intervalId) {
                    return;
                }
                if (doDebug) {

                    debugLog(" Session OK ? ", the_session.isChannelValid(),
                        "session will expired in ", the_session.evaluateRemainingLifetime() / 1000, " seconds",
                        chalk.red("subscription will expire in "), the_subscription.evaluateRemainingLifetime() / 1000, " seconds",
                        chalk.red("subscription?"), the_session.subscriptionCount);
                }
                if (!the_session.isChannelValid() && false) {
                    //xx debugLog(the_session.toString());
                    return; // ignore write as session is invalid for the time being
                }

                let nodeToWrite = {
                    nodeId: nodeId,
                    attributeId: opcua.AttributeIds.Value,
                    value: /* DataValue */{
                        statusCode: opcua.StatusCodes.Good,
                        sourceTimestamp: new Date(),
                        value: /* Variant */{
                            dataType: opcua.DataType.Int32,
                            value: counter
                        }
                    }
                };
                the_session.write(nodeToWrite, function(err, statusCode) {
                    if (err) {
                        if (doDebug) {
                            debugLog(chalk.red("       writing Failed "), err.message);
                        }
                    } else {
                        if (doDebug) {
                            debugLog("       writing OK counter =", counter, statusCode.toString());
                        }
                        counter += 1;
                    }
                    //xx statusCode && statusCode.length===1) ? statusCode[0].toString():"");
                    setTimeout(writeValue, 500);
                });
            }
            intervalId = setInterval(function() {
            }, 250);
            writeValue();

            callback();
        },

        function wait_for_activity_to_settle(callback) {
            setTimeout(callback, 1000);
        }
    ], function(err) {
        if (doDebug) {
            debugLog("  --------------------------------------------------\n\n\n");
        }
        callback(err);
    });
}

function terminate_active_client(callback) {

    if (!client) {
        return callback();
    }

    async.series([
        // close session
        function client_close_session(callback) {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            if (!the_session) {
                return callback();
            }
            the_session.close(function(err) {
                if (err) {
                    debugLog("session closed failed ?");
                }
                callback();
            });
        },

        function client_disconnect(callback) {
            client.disconnect(function() {
                client = null;
                callback();
            });
        }

    ], callback);
}

function f(func) {
    return function(callback) {
        debugLog("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        return func(callback);
    };
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing client reconnection with crashing server", function() {

    this.timeout(100000);

    afterEach(function(done) {
        debugLog("------------------------- Terminating client ----------------------------");
        terminate_active_client(function() {
            crash_external_opcua_server(done);
        });
    });

    function given_a_running_opcua_server(callback) {

        start_external_opcua_server(function(err) {
            callback();
        });
    }

    function when_the_server_crash(callback) {
        crash_external_opcua_server(function(err) {
            callback();
        });
    }

    function when_the_server_restart(callback) {

        start_external_opcua_server(function(err) {
            callback();
        });
    }

    function when_the_server_restart_after_some_very_long_time(callback) {
        setTimeout(() => {
            when_the_server_restart(callback);
        }, 10000);
    }

    function given_a_active_client_with_subscription_and_monitored_items(callback) {
        // this client starts with default parameters
        start_active_client(undefined, callback);
    }

    function given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy(callback) {
        // this client starts with fail fast connection strategy
        start_active_client({ maxRetry: 2, initialDelay: 100, maxDelay: 200 }, callback);
    }

    function then_client_should_detect_failure_and_enter_reconnection_mode(callback) {

        let backoff_counter = 0;

        function backoff_detector() {
            backoff_counter += 1;
            if (backoff_counter === 2) {
                if (doDebug) {
                    debugLog("Bingo !  Client has detected disconnection and is currently trying to reconnect");
                }
                client.removeListener("backoff", backoff_detector);
                callback();
            }
        }

        client.on("backoff", backoff_detector);

    }

    function then_client_should_reconnect_and_restore_subscription(callback) {

        let change_counter = 0;

        function on_value_changed(dataValue) {
            change_counter += 1;
            if (doDebug) {
                debugLog(" |||||||||||||||||||| DataValue changed again !!!", dataValue.toString());
            }
            if (change_counter === 3) {
                monitoredItem.removeListener("value_changed", on_value_changed);
                callback();
            }
        }

        monitoredItem.on("changed", on_value_changed);
    }

    it("should reconnection and restore subscriptions when server becomes available again", function(done) {

        async.series([
            f(given_a_running_opcua_server),
            f(given_a_active_client_with_subscription_and_monitored_items),
            f(when_the_server_crash),
            f(then_client_should_detect_failure_and_enter_reconnection_mode),
            f(when_the_server_restart),
            f(then_client_should_reconnect_and_restore_subscription)
        ], done);
    });
    it("testing reconnection with failFastReconnection strategy #606", function(done) {

        // rationale:
        //  even if the OPCUAClient  uses a fail fast reconnection strategy, a lost of connection
        //  should cause an infinite retry to connect again
        async.series([
            f(given_a_running_opcua_server),
            f(given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy),
            f(when_the_server_crash),
            f(then_client_should_detect_failure_and_enter_reconnection_mode),
            f(when_the_server_restart_after_some_very_long_time),
            f(then_client_should_reconnect_and_restore_subscription)
        ], done);
    });

});