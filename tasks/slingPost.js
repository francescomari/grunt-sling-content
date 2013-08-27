var fs = require("fs");
var path = require("path");
var util = require("util");
var async = require("async");

var servlet = require("./lib/servlet");

function concat(parent, node) {
    return parent.slice(-1) === "/" ? parent + node : parent + "/" + node;
}

module.exports = function (grunt) {
    grunt.registerMultiTask("slingPost", function () {
        var options = this.options({
            host: "localhost",
            port: 8080,
            user: "admin",
            pass: "admin"
        });

        grunt.verbose.writeln("Host: " + options.host);
        grunt.verbose.writeln("Port: " + options.port);
        grunt.verbose.writeln("User: " + options.user);

        var done = this.async();

        var postServlet = new servlet.Post(options);

        this.files.forEach(postRoots);

        function postRoots(file) {
            file.src.forEach(function (root) {
                if (grunt.file.exists(root) === false) {
                    grunt.fatal(util.format("The directory %s does not exist.", root));
                }

                if (grunt.file.isDir(root) === false) {
                    grunt.fatal(util.format("The path %s is not a directory.", root));
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
                return grunt.file.isFile(root, child) && path.extname(child) !== ".json";
            });

            // Filter out directories

            var directories = children.filter(function (child) {
                return grunt.file.isDir(root, child);
            });

            // Filter out descriptors

            var descriptors = children.filter(function (child) {
                return grunt.file.isFile(root, child) && path.extname(child) === ".json";
            });

            // Create a descriptor map (base name -> json content)

            function toDescriptorMap(map, descriptor) {
                var base = path.basename(descriptor, ".json");
                var json = grunt.file.readJSON(path.join(root, descriptor));

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
                        grunt.warn(util.format("Error writing %s: %s: %s.", b.path, b.error.class, b.error.message));
                    }

                    done(err, response, body);
                };
            }

            // Creates a task to create/update a file

            function toFileTasks(file) {
                return function (done) {
                    grunt.log.writeln("File: " + path.join(root, file));
                    postServlet.createFile(resource, path.join(root, file), propertiesFor(file), withWarnings(done));
                };
            }

            var fileTasks = files.map(toFileTasks);

            // Creates a task to create/update a folder

            function toDirectoryTask(directory) {
                return function (done) {
                    grunt.log.writeln("Dir : " + path.join(root, directory));

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

                    grunt.log.writeln("Node: " + jsonName);

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
    });
};