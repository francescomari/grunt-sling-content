var fs = require("fs");
var path = require("path");
var util = require("util");
var async = require("async");

var servlet = require("./lib/servlet");

module.exports = function (grunt) {
    grunt.registerMultiTask("sling", function () {
        var options = this.options({
            host: "localhost",
            port: 8080,
            user: "admin",
            pass: "admin"
        });

        var done = this.async();

        var postServlet = new servlet.Post(options);

        this.files.forEach(postRoots);

        function postRoots(file) {
            file.src.forEach(function (root) {
                if (grunt.file.exists(root) === false) {
                    grunt.fail.fatal("The directory " + root + " does not exist");
                }

                if (grunt.file.isDir(root) === false) {
                    grunt.file.fatal("The path " + root + " is not a directory");
                }
            });

            var tasks = file.src.map(function (directory) {
                return createRootDirectoryTask(directory, "/");
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

            // Creates a task to create/update a file

            function toFileTasks(file) {
                return function (done) {
                    grunt.log.writeln("File: " + path.join(root, file));
                    postServlet.createFile(resource, path.join(root, file), propertiesFor(file), done);
                };
            }

            var fileTasks = files.map(toFileTasks);

            // Creates a task to create/update a folder

            function toDirectoryTask(directory) {
                return function (done) {
                    grunt.log.writeln("Dir : " + path.join(root, directory));
                    postServlet.create(resource + directory, propertiesFor(directory), done);
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
                    grunt.log.writeln("Node: " + path.join(root, name + ".json"));
                    postServlet.create(resource + name, propertiesFor(name), done);
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
                    return createRootDirectoryTask(path.join(root, directory), resource + directory + "/");
                });

                async.parallel(tasks, done);
            }
        }
    });
};