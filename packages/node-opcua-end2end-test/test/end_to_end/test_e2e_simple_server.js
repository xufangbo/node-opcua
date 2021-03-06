
"use strict";
const should = require("should");

const {OPCUAServer, OPCUAClient, get_empty_nodeset_filename, parseEndpointUrl} = require("node-opcua");
const { getFullyQualifiedDomainName } = require("node-opcua-hostname");


const empty_nodeset_filename = get_empty_nodeset_filename();

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const port = 6789;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing a simple server from Server side", function () {

    it("should have at least one endpoint", function (done) {

        const server = new OPCUAServer({port, nodeset_filename: empty_nodeset_filename});

        server.start(()=>{

            server.endpoints.length.should.be.greaterThan(0);

            const endPoint = server.endpoints[0];

            const e = parseEndpointUrl(endPoint.endpointDescriptions()[0].endpointUrl);

            const expected_hostname = getFullyQualifiedDomainName();
            e.hostname.toLowerCase().should.be.match(new RegExp(expected_hostname.toLowerCase()));

            e.port.should.eql("6789");

            server.shutdown(done);

        });

    });
    it("OPCUAServer#getChannels", function (done) {


        const server = new OPCUAServer({port, nodeset_filename: empty_nodeset_filename});
        server.getChannels().length.should.equal(0);

        server.start(function () {

            server.getChannels().length.should.equal(0);

            // now make a simple connection
            const endpointUrl = server.getEndpointUrl();

            const options = {};
            const client = OPCUAClient.create(options);
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                server.getChannels().length.should.equal(1);
                //xx console.log("xxxxx nb Channels ",server.getChannels().length);
                inner_done();
            }, function () {
                server.shutdown(function () {
                    OPCUAServer.registry.count().should.eql(0);
                    done();
                });
            });
        });

    });


    it("should start and shutdown", function (done) {

        const server = new OPCUAServer({port, nodeset_filename: empty_nodeset_filename});

        server.start(function () {
            process.nextTick(function () {
                server.shutdown(function () {
                    done();
                });
            });
        });
    });

});


