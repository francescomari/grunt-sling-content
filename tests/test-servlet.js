var util = require("util");
var path = require("path");

var servlet = require("../tasks/lib/servlet");

var mock = require("./mock");

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

        var send = function (done) {
            var post = new servlet.Post(self.options);

            var properties = {
                string: "s",
                integer: 1,
                stringArray: ["t", "u"],
                integerArray: [2, 3],
                bool: true
            };

            post.create("/content/node", properties, done);
        };

        var verify = function (requests) {
            var exists;

            exists = requests
                .withUser(HTTP_USER)
                .withMethod("post")
                .withPath("/content/node")
                .withField("string", "s")
                .withField("integer", "1")
                .withField("stringArray", ["t", "u"])
                .withField("integerArray", ["2", "3"])
                .withField("bool", "true")
                .notEmpty();

            test.ok(exists);

            test.done();
        };

        mock.server(HTTP_PORT, send, verify);
    },

    createWithNoFields: function (test) {
        var self = this;

        var send = function (done) {
            var post = new servlet.Post(self.options);

            post.create("/content/node", {}, done);
        };

        var verify = function (requests) {
            var exists;

            exists = requests
                .withUser(HTTP_USER)
                .withMethod("post")
                .withPath("/content/node")
                .notEmpty();

            test.ok(exists);

            test.done();
        };

        mock.server(HTTP_PORT, send, verify);
    },

    createFile: function (test) {
        var self = this;

        var send = function (done) {
            var post = new servlet.Post(self.options);

            var properties = {
                property: "value"
            };

            var file = path.join(__dirname, "files", "test");

            post.createFile("/content/node", file, properties, done);
        };

        var verify = function (requests) {
            var exists;

            exists = requests
                .withUser(HTTP_USER)
                .withMethod("post")
                .withPath("/content/node")
                .withFile("./test")
                .withField("./test/property", "value")
                .notEmpty();

            test.ok(exists);

            test.done();
        };

        mock.server(HTTP_PORT, send, verify);
    },

    importContent: function (test) {
        var self = this;

        var send = function (done) {
            var post = new servlet.Post(self.options);

            var properties = {
                checkin: true,
                autoCheckout: true,
                replace: true,
                replaceProperties: true
            };

            var file = path.join(__dirname, "files", "test");            

            post.importContent("/content", "node", file, "json", properties, done);
        };

        var verify = function (requests) {
            var exists;

            exists = requests
                .withUser(HTTP_USER)
                .withMethod("post")
                .withPath("/content")
                .withFile(":contentFile")
                .withField(":name", "node")
                .withField(":contentType", "json")
                .withField(":checkin", "true")
                .withField(":autoCheckout", "true")
                .withField(":replace", "true")
                .withField(":replaceProperties", "true")
                .notEmpty();

            test.ok(exists);

            test.done();
        };

        mock.server(HTTP_PORT, send, verify);
    }
};