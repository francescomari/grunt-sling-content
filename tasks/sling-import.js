var util = require("util");
var path = require("path");
var async = require("async");

var servlet = require("./lib/servlet");

function SlingImport(grunt, task) {
    this.grunt = grunt;
    this.task = task;
}

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

module.exports = function (grunt) {
    grunt.registerMultiTask("slingImport", function () {
        new SlingImport(grunt, this).run();
    });
};