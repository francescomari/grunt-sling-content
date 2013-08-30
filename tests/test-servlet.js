var util = require("util");
var path = require("path");

var servlet = require("../tasks/lib/servlet");

var MockServer = require("./mock-server");

var HTTP_PORT = 8080;
var HTTP_HOST = "localhost";
var HTTP_USER = "user";
var HTTP_PASS = "pass";

module.exports = {
    setUp: function (done) {
        this.port = 8080;

        this.options = {
            host: HTTP_HOST,
            port: HTTP_PORT,
            user: HTTP_USER,
            pass: HTTP_PASS
        };

        done();
    },

    create: function (test) {
        var self = this;

        var server = new MockServer(test);

        server.usePort(self.port);

        server.expectUser(HTTP_USER);
        server.expectPass(HTTP_PASS);
        server.expectMethod("post");
        server.expectPath("/content/node");

        var properties = {
            s: "s",
            i: 1,
            as: ["t", "u"],
            ai: [2, 3]
        };

        server.expectProperties(properties);

        server.listen(function (done) {
            var post = new servlet.Post(self.options);
            post.create("/content/node", properties, done);
        });
    },

    createFile: function (test) {
        var self = this;

        var server = new MockServer(test);

        server.usePort(self.port);

        server.expectUser(HTTP_USER);
        server.expectPass(HTTP_PASS);
        server.expectMethod("post");
        server.expectPath("/content/node");
        server.expectFile("./test.txt");

        server.expectProperties({
            "./test.txt/one": 1,
            "./test.txt/two": 2
        });

        server.listen(function (done) {
            var post = new servlet.Post(self.options);

            var properties = {
                one: 1,
                two: 2
            };

            var file = path.join(__dirname, "files/test.txt");

            post.createFile("/content/node", file, properties, done);
        });
    },

    importContent: function (test) {
        var self = this;

        var server = new MockServer(test);

        server.usePort(self.port);

        server.expectUser(HTTP_USER);
        server.expectPass(HTTP_PASS);
        server.expectMethod("post");
        server.expectPath("/content");
        server.expectFile(":contentFile");

        server.expectProperties({
            ":name": "node",
            ":contentType": "json",
            ":checkin": "true",
            ":autoCheckout": "true",
            ":replace": "true",
            ":replaceProperties": "true"
        });

        server.listen(function (done) {
            var post = new servlet.Post(self.options);

            var properties = {
                checkin: true,
                autoCheckout: true,
                replace: true,
                replaceProperties: true
            };

            var file = path.join(__dirname, "files/content.json");            

            post.importContent("/content", "node", file, "json", properties, done);
        });
    }
};