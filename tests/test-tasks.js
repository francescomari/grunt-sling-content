var fs = require("fs");
var path = require("path");
var util = require("util");

var tasks = require("../tasks/lib/tasks");

var mock = require("./mock");

var HTTP_PORT = 8080;
var HTTP_HOST = "localhost";
var HTTP_USER = "user";
var HTTP_PASS = "pass";

var HTTP_OPTS = {
    host: HTTP_HOST,
    port: HTTP_PORT,
    user: HTTP_USER,
    pass: HTTP_PASS
};

exports.directoryHandler = {
    getServlet: function (test) {
        var task = {
            getOptions: function () {
                return HTTP_OPTS;
            }
        };

        var handler = new tasks.DirectoryHandler(task);

        var servlet = handler.getServlet();

        test.ok(servlet, "No servlet returned");

        var another = handler.getServlet();

        test.equal(another, servlet, "The servlet is not cached");

        test.done();
    },

   getFiles: function (test) {
        var handler = new tasks.DirectoryHandler();

        handler.getChildren = function () {
            return ["yes.txt", "yes.json", "no"];
        };

        handler.isFile = function (directory, name) {
            if (name === "yes.txt") {
                return true;
            }

            if (name === "yes.json") {
                return true;
            }

            return false;
        };

        var files = handler.getFiles();
        var expected = ["yes.txt"];

        test.equal(files.toString(), expected.toString(), "Files not expected");

        var another = handler.getFiles();

        test.equal(another, files, "Files are not cached");

        test.done();
    },

    getDirectories: function (test) {
        var handler = new tasks.DirectoryHandler();

        handler.getChildren = function () {
            return ["yes", "no.txt"];
        };

        handler.isDir = function (directory, name) {
            if (name === "yes") {
                return true;
            }

            return false;
        };

        var directories = handler.getDirectories();
        var expected = ["yes"];

        test.equal(directories.toString(), expected.toString(), "Directories not expected");

        var another = handler.getDirectories();

        test.equal(another, directories, "Directories are not cached");

        test.done();
    },

    getDescriptors: function (test) {
        var handler = new tasks.DirectoryHandler();

        handler.getChildren = function () {
            return ["yes.txt", "yes.json", "no"];
        };

        handler.isFile = function (directory, name) {
            if (name === "yes.txt") {
                return true;
            }

            if (name === "yes.json") {
                return true;
            }

            return false;
        };

        var desccriptors = handler.getDescriptors();
        var expected = ["yes.json"];

        test.equal(desccriptors.toString(), expected.toString(), "Desccriptors not expected");

        var another = handler.getDescriptors();

        test.equal(another, desccriptors, "Desccriptors are not cached");

        test.done();
    },

    getDescriptorMap: function (test) {
        var handler = new tasks.DirectoryHandler();

        handler.getDescriptors = function () {
            return ["one.json", "two.json"];
        };

        handler.readJSON = function (dir, name) {
            if (name == "one.json") {
                return { name: "one" };
            }

            if (name == "two.json") {
                return { name: "two" };
            }

            return null;
        };

        var map = handler.getDescriptorMap();

        test.ok(map.one, "Descriptor not found");
        test.equal(map.one.name, "one", "Descriptor has wrong content");
        test.ok(map.two, "Descriptor not found");
        test.equal(map.two.name, "two", "Descriptor has wrong content");
        
        var another = handler.getDescriptorMap();

        test.equal(another, map, "Descriptor map is not cached");

        test.done();
    },

    propertiesFor: function (test) {
        var handler = new tasks.DirectoryHandler();

        handler.getDescriptorMap = function () {
            return {
                one: {
                    name: "one"
                }
            };
        };

        var properties = handler.propertiesFor("one.txt", {
            name: "overridden",
            other: "other"
        });

        test.equal(properties.name, "one");
        test.equal(properties.other, "other");
        
        test.done();
    },

    getUnusedDescriptorNames: function (test) {
        var handler = new tasks.DirectoryHandler();

        handler.getFiles = function () {
            return ["file.txt"];
        };

        handler.getDirectories = function () {
            return ["directory"];
        };

        handler.getDescriptorMap = function () {
            return {
                "file": {},
                "directory": {},
                "node": {}
            };
        };

        var names = handler.getUnusedDescriptorNames();
        var expected = ["node"];

        test.equal(names.toString(), expected.toString());

        test.done();
    },

    post: function (test) {
        var self = this;

        // Mock the task
        
        var task = {
            getOptions: function () {
                return HTTP_OPTS;
            },
            grunt: {
                log: {
                    writeln: function () {}
                }
            }
        };

        // Select test dir

        var dir = path.join(__dirname, "files", "content");

        // Map to test dir to content

        var resource = "/content";
        
        // Mock the handler
        
        function MockDirectoryHandler(task, dir, resource) {
            tasks.DirectoryHandler.call(this, task, dir, resource);
        }

        util.inherits(MockDirectoryHandler, tasks.DirectoryHandler);

        MockDirectoryHandler.prototype.isFile = function (dir, name) {
            return fs.statSync(path.join(dir, name)).isFile();
        };

        MockDirectoryHandler.prototype.isDir = function (dir, name) {
            return fs.statSync(path.join(dir, name)).isDirectory();
        };

        MockDirectoryHandler.prototype.readJSON = function (dir, name) {
            return JSON.parse(fs.readFileSync(path.join(dir, name)));
        };

        MockDirectoryHandler.prototype.decorateCallback = function (callback) {
            return callback;
        };

        MockDirectoryHandler.prototype.createHandler = function (directory, resource) {
            return new MockDirectoryHandler(this.task, directory, resource);
        };

        var handler = new MockDirectoryHandler(task, dir, resource);

        // Callback to post the directory

        var send = function (done) {
            handler.post(done);
        };

        // Callback to verify the requests

        var verify = function (requests) {
            var exists;

            exists = requests
                .withUser(HTTP_USER)
                .withMethod("post")
                .withPath("/content/dir")
                .withField("jcr:primaryType", "sling:Folder")
                .notEmpty();

            test.ok(exists);

            exists = requests
                .withUser(HTTP_USER)
                .withMethod("post")
                .withPath("/content/node")
                .withField("name", "node")
                .notEmpty();

            test.ok(exists);

            exists = requests
                .withUser(HTTP_USER)
                .withMethod("post")
                .withPath("/content")
                .withFile("./outer.txt")
                .withField("./outer.txt/name", "outer")
                .notEmpty();

            test.ok(exists);

            exists = requests
                .withUser(HTTP_USER)
                .withMethod("post")
                .withPath("/content/dir")
                .withFile("./inner.txt")
                .notEmpty();

            test.ok(exists);

            test.done();
        };

        // Start the test

        mock.server(HTTP_PORT, send, verify);
    }
};