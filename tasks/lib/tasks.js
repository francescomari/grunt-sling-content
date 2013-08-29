var fs = require("fs");
var path = require("path");
var util = require("util");
var async = require("async");

var servlet = require("./servlet");

function SlingPost(grunt, task) {
    this.grunt = grunt;
    this.task = task;
}

exports.SlingPost = SlingPost;

SlingPost.prototype.run = function() {
    var self = this;

    var options = self.task.options({
        host: "localhost",
        port: 8080,
        user: "admin",
        pass: "admin"
    });

    self.grunt.verbose.writeln("Host: " + options.host);
    self.grunt.verbose.writeln("Port: " + options.port);
    self.grunt.verbose.writeln("User: " + options.user);

    var done = self.task.async();

    var postServlet = new servlet.Post(options);

    self.task.files.forEach(postRoots);

    function postRoots(file) {
        file.src.forEach(function (root) {
            if (self.grunt.file.exists(root) === false) {
                self.grunt.fatal(util.format("The directory %s does not exist.", root));
            }

            if (self.grunt.file.isDir(root) === false) {
                self.grunt.fatal(util.format("The path %s is not a directory.", root));
            }
        });

        var tasks = file.src.map(function (directory) {
            return createRootDirectoryTask(directory, file.dest);
        });

        async.parallel(tasks, done);
    }

    function createRootDirectoryTask(root, resource) {
        return function (done) {
            postRecursively(root, resource, done);
        };
    }

    function postRecursively(root, resource, done) {

        // Read content of the current directory

        var children = fs.readdirSync(root);

        // Filter out files

        var files = children.filter(function (child) {
            return self.grunt.file.isFile(root, child) && path.extname(child) !== ".json";
        });

        // Filter out directories

        var directories = children.filter(function (child) {
            return self.grunt.file.isDir(root, child);
        });

        // Filter out descriptors

        var descriptors = children.filter(function (child) {
            return self.grunt.file.isFile(root, child) && path.extname(child) === ".json";
        });

        // Create a descriptor map (base name -> json content)

        function toDescriptorMap(map, descriptor) {
            var base = path.basename(descriptor, ".json");
            var json = self.grunt.file.readJSON(path.join(root, descriptor));

            map[base] = json;

            return map;
        }

        var descriptorMap = descriptors.reduce(toDescriptorMap, {});

        // Return an object with properties for the selected file

        function propertiesFor(name, initial) {
            var base = path.basename(name, path.extname(name));

            var descriptor = descriptorMap[base] || {};

            function toProperties(map, name) {
                map[name] = descriptor[name];
                return map;
            }

            return Object.keys(descriptor).reduce(toProperties, initial || {});
        }

        // Wraps a function to report warnings at servlet failures

        function withWarnings(done) {
            return function (err, response, body) {
                if (err) {
                    return done(err);
                }

                var b = JSON.parse(body);

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    self.grunt.warn(util.format("Error writing %s: %s: %s.", b.path, b.error.class, b.error.message));
                }

                done(err, response, body);
            };
        }

        // Creates a task to create/update a file

        function toFileTasks(file) {
            return function (done) {
                self.grunt.log.writeln("File: " + path.join(root, file));
                postServlet.createFile(resource, path.join(root, file), propertiesFor(file), withWarnings(done));
            };
        }

        var fileTasks = files.map(toFileTasks);

        function concat(parent, node) {
            return parent.slice(-1) === "/" ? parent + node : parent + "/" + node;
        }

        // Creates a task to create/update a folder

        function toDirectoryTask(directory) {
            return function (done) {
                self.grunt.log.writeln("Dir : " + path.join(root, directory));

                var properties = propertiesFor(directory, {
                    "jcr:primaryType": "sling:Folder"
                });

                postServlet.create(concat(resource, directory), properties, withWarnings(done));
            };
        }

        var directoryTasks = directories.map(toDirectoryTask);

        // Creates a task to create/update generic nodes

        function unusedDescriptor(name) {
            var usedForDirectories = directories.some(function (directory) {
                return directory === name;
            });

            var usedForFiles = files.some(function (file) {
                return path.basename(file, path.extname(file)) === name;
            });

            return !usedForFiles && !usedForDirectories;
        }

        function toNodeTask(name) {
            return function (done) {
                var jsonName = path.join(root, name + ".json");

                self.grunt.log.writeln("Node: " + jsonName);

                postServlet.create(concat(resource, name), propertiesFor(jsonName), withWarnings(done));
            };
        }

        var nodeTasks = Object.keys(descriptorMap).filter(unusedDescriptor).map(toNodeTask);

        // Executes every task in parallel

        async.parallel(fileTasks.concat(nodeTasks).concat(directoryTasks), recurseSubdirectories);

        // When work is done in this directory, recurse in subdirectories

        function recurseSubdirectories(err) {
            if (err) {
                return done(err);
            }

            var tasks = directories.map(function (directory) {
                return createRootDirectoryTask(path.join(root, directory), concat(resource, directory));
            });

            async.parallel(tasks, done);
        }
    }
};

function SlingImport(grunt, task) {
    this.grunt = grunt;
    this.task = task;
}

exports.SlingImport = SlingImport;

SlingImport.prototype.run = function() {
    var grunt = this.grunt;

    function printOptions(grunt, options) {
        grunt.verbose.writeln("Host: " + options.host);
        grunt.verbose.writeln("Port: " + options.port);
        grunt.verbose.writeln("User: " + options.user);
        grunt.verbose.writeln("Checkin: " + options.checkin);
        grunt.verbose.writeln("Auto-checkout: " + options.checkin);
        grunt.verbose.writeln("Replace: " + options.checkin);
        grunt.verbose.writeln("Replace properties: " + options.checkin);
    }

    function validateImportTypes(grunt, files) {
        files.forEach(function (group) {
            group.src.forEach(function (file) {
                if (!getImportType(file)) {
                    grunt.fatal(util.format("Unable to determine the import type of %s", file));
                }
            });
        });
    }

    function getImportType(file) {
        var supported = ["json", "jar", "zip", "jcr.xml", "xml"];
        
        var i;

        for (i = 0; i < supported.length; i++) {
            var extension = "." + supported[i];

            // Is the file using an import type as extension?

            if (file.indexOf(extension, file.length - extension.length) !== -1) {
                return supported[i];
            }
        }
    }

    function getNodeName(file, type) {
        var base = path.basename(file);
        return base.slice(0, base.length - type.length - 1);
    }

    var options = this.task.options({
        host: "localhost",
        port: 8080,
        user: "admin",
        pass: "admin",
        checkin: false,
        autoCheckout: false,
        replace: false,
        replaceProperties: false
    });

    printOptions(grunt, options);

    validateImportTypes(grunt, this.task.files);

    var tasks = [];

    var postServlet = new servlet.Post(options);

    function withWarnings(done) {
        return function (err, response, body) {
            if (err) {
                return done(err);
            }

            var b = JSON.parse(body);

            if (response.statusCode < 200 || response.statusCode >= 300) {
                grunt.warn(util.format("Error writing %s: %s.", b.path, b["status.message"]));
            }

            done(err, response, body);
        };
    }

    function createImportTask(node, file, options) {
        return function (done) {
            var type = getImportType(file);
            var name = getNodeName(file, type);

            grunt.log.writeln(util.format("Importing %s with type '%s'", file, type));

            postServlet.importContent(node, name, file, type, options, withWarnings(done));
        };
    }

    this.task.files.forEach(function (group) {
        group.src.forEach(function (file) {
            tasks.push(createImportTask(group.orig.dest, file, options));
        });
    });

    async.parallel(tasks, this.task.async());
};